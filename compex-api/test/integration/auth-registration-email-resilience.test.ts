import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

// Mirrors auth-verification-link.test.ts's mocking pattern: replace only
// sendEmail so every other export (verificationEmail, accountSetupEmail,
// etc.) keeps its real implementation.
const sendEmailMock = vi.fn();
vi.mock("../../src/lib/email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/email.js")>();
  return { ...actual, sendEmail: sendEmailMock };
});

function delay(ms: number): Promise<{ messageId?: string }> {
  return new Promise((resolve) => setTimeout(() => resolve({ messageId: "late" }), ms));
}

function neverResolves(): Promise<{ messageId?: string }> {
  return new Promise(() => {
    /* simulates a hung SMTP connection that never times out on its own */
  });
}

function makePassword(): string {
  return `A1${randomUUID().replaceAll("-", "")}`;
}

function makeRegistration(email: string) {
  return {
    companyName: "Resilience Test Co",
    firstName: "Rex",
    lastName: "Ilient",
    email,
    phone: "9876543210",
    password: makePassword(),
  };
}

describe("registration survives a broken email provider", () => {
  let app: FastifyInstance;
  let prisma: typeof import("../../src/lib/prisma.js").prisma;

  beforeAll(async () => {
    const { createTestApp, cleanDb } = await import("./helpers.js");
    ({ prisma } = await import("../../src/lib/prisma.js"));
    await cleanDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    sendEmailMock.mockReset();
  });

  it(
    "returns 201 promptly (well under the 8s email timeout) when the email provider hangs indefinitely",
    async () => {
      sendEmailMock.mockImplementation(neverResolves);
      const payload = makeRegistration("hangs@resilience.test");

      const started = Date.now();
      const res = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
      const elapsedMs = Date.now() - started;

      expect(res.statusCode).toBe(201);
      expect(elapsedMs).toBeLessThan(9_000);
      expect(res.json().data.message).toMatch(/could not send the verification email/i);

      // The account itself must exist and be durably created despite the
      // stuck email -- this is the whole point of the fix.
      const user = await prisma.user.findUnique({ where: { email: payload.email } });
      expect(user).toBeTruthy();
      expect(user?.status).toBe("PENDING_VERIFICATION");
      const verification = await prisma.emailVerification.findUnique({ where: { userId: user!.id } });
      expect(verification).toBeTruthy();
    },
    12_000,
  );

  it("returns 201 and keeps the account when the email provider rejects outright", async () => {
    sendEmailMock.mockRejectedValue(new Error("SMTP 550 relay denied"));
    const payload = makeRegistration("rejects@resilience.test");

    const res = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.message).toMatch(/could not send the verification email/i);
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    expect(user).toBeTruthy();
  });

  it("still returns 201 with the normal message when email delivery succeeds", async () => {
    sendEmailMock.mockResolvedValue({ messageId: "ok" });
    const payload = makeRegistration("succeeds@resilience.test");

    const res = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.message).toBe("Registration successful. Please verify your email.");
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it("still rejects duplicate registration with 409 even though email is mocked", async () => {
    sendEmailMock.mockResolvedValue({ messageId: "ok" });
    const payload = makeRegistration("duplicate@resilience.test");

    const first = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
    expect(second.statusCode).toBe(409);
  });

  it("a slow-but-under-timeout email provider still lets registration succeed normally", async () => {
    sendEmailMock.mockImplementation(() => delay(50));
    const payload = makeRegistration("slowok@resilience.test");

    const res = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.message).toBe("Registration successful. Please verify your email.");
  });
});

describe("resend-verification", () => {
  let app: FastifyInstance;
  let prisma: typeof import("../../src/lib/prisma.js").prisma;

  beforeAll(async () => {
    const { createTestApp } = await import("./helpers.js");
    ({ prisma } = await import("../../src/lib/prisma.js"));
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ messageId: "ok" });
  });

  it("issues a fresh token and sends a new email for a pending account", async () => {
    const payload = makeRegistration("resend-me@resilience.test");
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
    const before = await prisma.emailVerification.findUniqueOrThrow({ where: { userId: user.id } });

    sendEmailMock.mockClear();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-verification",
      payload: { email: payload.email },
    });

    expect(res.statusCode).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledOnce();
    const after = await prisma.emailVerification.findUniqueOrThrow({ where: { userId: user.id } });
    expect(after.token).not.toBe(before.token);
  });

  it("returns the same generic message for an email that does not exist (no enumeration)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-verification",
      payload: { email: "nobody-at-all@resilience.test" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toMatch(/if an account with this email exists/i);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not resend (or leak status) for an already-verified account", async () => {
    const payload = makeRegistration("already-verified@resilience.test");
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
    await prisma.user.update({ where: { email: payload.email }, data: { status: "ACTIVE" } });

    sendEmailMock.mockClear();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-verification",
      payload: { email: payload.email },
    });

    expect(res.statusCode).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it(
    "returns 200 promptly even when the resend email provider hangs",
    async () => {
      const payload = makeRegistration("resend-hangs@resilience.test");
      sendEmailMock.mockResolvedValue({ messageId: "ok" });
      await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });

      sendEmailMock.mockImplementation(neverResolves);
      const started = Date.now();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/resend-verification",
        payload: { email: payload.email },
      });
      const elapsedMs = Date.now() - started;

      expect(res.statusCode).toBe(200);
      expect(elapsedMs).toBeLessThan(9_000);
    },
    12_000,
  );
});
