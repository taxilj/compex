import { describe, expect, it, vi } from "vitest";

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

import { sendEmail } from "../../src/lib/email.js";

describe("sendEmail via the existing SMTP transport", () => {
  it("uses the configured SMTP transport and returns its message ID", async () => {
    await expect(sendEmail({ to: "customer@example.com", subject: "RFQ", html: "<p>hello</p>" }))
      .resolves.toEqual({ messageId: "smtp-message-123" });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.example.test",
      port: 587,
      secure: false,
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
});
