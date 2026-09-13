import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors the mocking pattern used by website-enquiries.test.ts /
// verification-email.test.ts: replace config/env.js directly so this file
// controls EMAIL_PROVIDER/RESEND_API_KEY without touching real process.env
// (which test/.env sets to EMAIL_PROVIDER=test for the rest of the suite).
// vi.hoisted() is required because vi.mock() factories are hoisted above
// normal top-level const declarations.
const { RESEND_API_KEY } = vi.hoisted(() => ({
  RESEND_API_KEY: "re_test_secret_key_must_never_appear_in_assertions",
}));

vi.mock("../../src/config/env.js", () => ({
  env: {
    EMAIL_PROVIDER: "resend",
    EMAIL_FROM: "noreply@compexsolution.com",
    RESEND_API_KEY,
    NODE_ENV: "test",
  },
}));

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { testEmail: { create: vi.fn() } },
}));

import { sendEmail, EmailProviderError } from "../../src/lib/email.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("sendEmail via the Resend HTTPS API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("posts to the Resend API with the expected envelope and returns the message id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "resend-msg-123" }));

    const result = await sendEmail({
      to: "customer@example.com",
      subject: "RFQ Received — RFQ-2026-000001",
      html: "<p>hello</p>",
    });

    expect(result).toEqual({ messageId: "resend-msg-123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${RESEND_API_KEY}`);
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('"Compex Solution" <noreply@compexsolution.com>');
    expect(body.to).toEqual(["customer@example.com"]);
    expect(body.subject).toBe("RFQ Received — RFQ-2026-000001");
    expect(body.html).toBe("<p>hello</p>");
    expect(body.reply_to).toBeUndefined();
    expect(body.attachments).toBeUndefined();
  });

  it("includes reply_to only when a replyTo is given", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "x" }));
    await sendEmail({ to: "a@b.com", subject: "s", html: "<p>h</p>", replyTo: "buyer@example.com" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.reply_to).toBe("buyer@example.com");
  });

  it("base64-encodes attachment content and maps field names for the Resend API", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "x" }));
    await sendEmail({
      to: "a@b.com",
      subject: "s",
      html: "<p>h</p>",
      attachments: [{ filename: "quote.pdf", content: Buffer.from("PDF-DATA"), contentType: "application/pdf" }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.attachments).toEqual([
      { filename: "quote.pdf", content: Buffer.from("PDF-DATA").toString("base64"), content_type: "application/pdf" },
    ]);
  });

  it("throws a safe EmailProviderError on a non-2xx response, with the Resend error code and status but never the raw response body", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ name: "validation_error", message: "rejected recipient customer@example.com: sensitive detail" }, 422),
    );

    let caught: unknown;
    try {
      await sendEmail({ to: "a@b.com", subject: "s", html: "<p>h</p>" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EmailProviderError);
    expect((caught as EmailProviderError).code).toBe("validation_error");
    expect((caught as EmailProviderError).statusCode).toBe(422);
    expect((caught as Error).message).not.toContain("customer@example.com");
    expect((caught as Error).message).not.toContain("sensitive detail");
  });

  it("throws EmailProviderError(code=ETIMEDOUT) when the request is aborted", async () => {
    fetchMock.mockImplementation(() => {
      const err = new Error("This operation was aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    let caught: unknown;
    try {
      await sendEmail({ to: "a@b.com", subject: "s", html: "<p>h</p>" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EmailProviderError);
    expect((caught as EmailProviderError).code).toBe("ETIMEDOUT");
  });

  it("wraps a generic network failure without swallowing it silently", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(sendEmail({ to: "a@b.com", subject: "s", html: "<p>h</p>" })).rejects.toBeInstanceOf(EmailProviderError);
  });

  it("never leaks the API key in a thrown error's own enumerable content", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ name: "unauthorized" }, 401));

    let caught: unknown;
    try {
      await sendEmail({ to: "a@b.com", subject: "s", html: "<p>h</p>" });
    } catch (error) {
      caught = error;
    }

    const serialized = JSON.stringify(caught, Object.getOwnPropertyNames(caught as object));
    expect(serialized).not.toContain(RESEND_API_KEY);
    expect(serialized).not.toContain("Authorization");
  });

  it("never puts the html body or recipient into the request Authorization header (sanity check on request shape)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "x" }));
    await sendEmail({ to: "secret-recipient@example.com", subject: "s", html: "<p>very secret body</p>" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe(`Bearer ${RESEND_API_KEY}`);
    expect(init.headers.Authorization).not.toContain("secret-recipient@example.com");
    expect(init.headers.Authorization).not.toContain("very secret body");
  });
});
