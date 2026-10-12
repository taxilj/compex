import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTransport, sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn().mockResolvedValue({ messageId: "smtp-message-123" }),
  createTransport: vi.fn(),
}));

createTransport.mockReturnValue({ sendMail });

vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("../../src/config/env.js", () => ({
  env: {
    EMAIL_PROVIDER: "smtp",
    EMAIL_FROM: "noreply@compexsolution.com",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: 587,
    SMTP_USER: "smtp-user",
    SMTP_PASS: "smtp-password",
    NODE_ENV: "production",
  },
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { testEmail: { create: vi.fn() } },
}));

import { describeEmailError, emailFailureReason, isTransientEmailError, sendEmail, sendEmailWithRetry } from "../../src/lib/email.js";

describe("sendEmail via the existing SMTP transport", () => {
  it("uses the configured SMTP transport and returns its message ID", async () => {
    await expect(sendEmail({ to: "customer@example.com", subject: "RFQ", html: "<p>hello</p>" }))
      .resolves.toEqual({ messageId: "smtp-message-123" });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      requireTLS: true,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: '"Compex Solution" <noreply@compexsolution.com>',
      to: "customer@example.com",
      subject: "RFQ",
    }));
  });

  it("discards SMTP response text and credentials while retaining safe diagnostics", async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error("AUTH synthetic-secret customer@example.com"), {
      code: "EAUTH", responseCode: 535, response: "synthetic-secret", hostname: "private-host",
    }));
    const error = await sendEmail({ to: "customer@example.com", subject: "QA", html: "<p>QA</p>" }).catch((error) => error);
    expect(error).toMatchObject({ message: "SMTP email delivery failed", code: "EAUTH", responseCode: 535 });
    expect(error.cause).toBeUndefined();
    expect(error.response).toBeUndefined();
    expect(error.hostname).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain("synthetic-secret");
  });
});

function smtpError(fields: { code?: string; command?: string; responseCode?: number; response?: string }) {
  return Object.assign(new Error(`SMTP failure ${fields.response ?? ""} for buyer@customer.example`), fields);
}

describe("SMTP retry classification", () => {
  it.each([
    ["connection refused (before any data was sent)", { code: "ECONNREFUSED", command: "CONN" }, true],
    ["DNS failure", { code: "EDNS" }, true],
    ["unresolvable host", { code: "ENOTFOUND" }, true],
    // nodemailer reports these as command CONN even while waiting for the reply to DATA, so the
    // server may already have accepted the message: retrying could double-send.
    ["timeout (may be after DATA)", { code: "ETIMEDOUT", command: "CONN" }, false],
    ["connection reset (may be after DATA)", { code: "ECONNRESET", command: "CONN" }, false],
    ["socket error (may be after DATA)", { code: "ESOCKET", command: "CONN" }, false],
    ["connection closed (may be after DATA)", { code: "ECONNECTION", command: "CONN" }, false],
    ["4xx temporary reply (rate limited)", { code: "EENVELOPE", command: "RCPT TO", responseCode: 421 }, true],
    ["451 after DATA (server refused, not accepted)", { command: "DATA", responseCode: 451 }, true],
    ["5xx permanent reply", { code: "EENVELOPE", command: "RCPT TO", responseCode: 550 }, false],
    ["auth failure", { code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 }, false],
    ["unknown error", {}, false],
  ])("%s -> retry=%s", (_label, fields, expected) => {
    expect(isTransientEmailError(smtpError(fields))).toBe(expected);
  });
});

describe("SMTP delivery with retry and idempotency", () => {
  beforeEach(() => {
    sendMail.mockReset();
  });

  it("retries a connect-phase SMTP failure and reuses one fixed Message-ID for every attempt", async () => {
    sendMail
      .mockRejectedValueOnce(smtpError({ code: "ECONNREFUSED", command: "CONN" }))
      .mockRejectedValueOnce(smtpError({ command: "MAIL FROM", responseCode: 421 }))
      .mockResolvedValueOnce({ messageId: "<enquiry-notify.lead-1@compexsolution.com>" });

    const result = await sendEmailWithRetry(
      { to: "sales@compexsolution.com", subject: "s", html: "<p>h</p>", idempotencyKey: "enquiry-notify/lead-1" },
      [0, 0],
    );

    expect(result.attempts).toBe(3);
    const messageIds = sendMail.mock.calls.map(([mail]) => (mail as { messageId?: string }).messageId);
    expect(messageIds).toEqual(Array(3).fill("<enquiry-notify.lead-1@compexsolution.com>"));
  });

  it("does not retry a permanent SMTP rejection", async () => {
    sendMail.mockRejectedValue(smtpError({ command: "RCPT TO", responseCode: 550 }));
    await expect(sendEmailWithRetry({ to: "x@example.com", subject: "s", html: "h" }, [0, 0])).rejects.toBeTruthy();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("never retries a timeout, so a message the server may already have accepted is not sent twice", async () => {
    sendMail.mockRejectedValue(smtpError({ code: "ETIMEDOUT", command: "CONN" }));
    await expect(sendEmailWithRetry({ to: "x@example.com", subject: "s", html: "h" }, [0, 0])).rejects.toBeTruthy();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("stops after the bounded number of attempts", async () => {
    sendMail.mockRejectedValue(smtpError({ code: "ECONNREFUSED", command: "CONN" }));
    await expect(sendEmailWithRetry({ to: "x@example.com", subject: "s", html: "h" }, [0, 0])).rejects.toBeTruthy();
    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  it("sanitized diagnostics and stored reasons never carry the recipient or SMTP response text", () => {
    const err = smtpError({ code: "EENVELOPE", command: "RCPT TO", responseCode: 550, response: "550 5.1.1 <buyer@customer.example> no such user" });
    const serialized = JSON.stringify(describeEmailError(err)) + emailFailureReason(err);
    expect(serialized).not.toContain("buyer@customer.example");
    expect(serialized).not.toContain("no such user");
    expect(emailFailureReason(err)).toBe("Error EENVELOPE 550");
  });
});
