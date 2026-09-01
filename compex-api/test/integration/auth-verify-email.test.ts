import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

// verify-email must work under the real "test" email provider (writes to
// prisma.testEmail) so we can read the actual issued token back out --
// no need to mock sendEmail here, unlike the resilience suite.

function makePassword(): string {
  return `A1${randomUUID().replaceAll("-", "")}`;
}

function makeRegistration(email: string) {
  return {
    companyName: "Verify Flow Test Co",
    firstName: "Vera",
    lastName: "Ify",
    email,
    phone: "9876543210",
    password: makePassword(),
  };
}

describe("email verification flow", () => {
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

  async function registerAndGetToken(email: string) {
    const payload = makeRegistration(email);
    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
    const testEmail = await prisma.testEmail.findFirstOrThrow({
      where: { to: email },
      orderBy: { createdAt: "desc" },
    });
    const url = new URL(testEmail.actionUrl!);
    const token = url.searchParams.get("token")!;
    return { token, password: payload.password };
  }

  it("verifies a fresh token and activates the account", async () => {
    const { token } = await registerAndGetToken("verify-fresh@flow.test");

    const res = await app.inject({ method: "POST", url: "/api/v1/auth/verify-email", payload: { token } });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.message).toBe("Email verified. You can now log in.");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "verify-fresh@flow.test" } });
    expect(user.status).toBe("ACTIVE");
  });

  it(
    "re-using an already-verified token returns success, not 404 " +
      "(covers mail-provider link-scanners consuming the token before the user clicks it)",
    async () => {
      const { token } = await registerAndGetToken("verify-replay@flow.test");

      const first = await app.inject({ method: "POST", url: "/api/v1/auth/verify-email", payload: { token } });
      expect(first.statusCode).toBe(200);

      const second = await app.inject({ method: "POST", url: "/api/v1/auth/verify-email", payload: { token } });
      expect(second.statusCode).toBe(200);
      expect(second.json().data.message).toBe("Email already verified. You can log in.");

      // Still exactly one account, still ACTIVE -- replay must not be able to
      // do anything beyond confirm the already-verified state.
      const user = await prisma.user.findUniqueOrThrow({ where: { email: "verify-replay@flow.test" } });
      expect(user.status).toBe("ACTIVE");
    },
  );

  it("rejects a token that was never issued", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email",
      payload: { token: "not-a-real-token-".padEnd(64, "0") },
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects an expired token without activating the account", async () => {
    const { token } = await registerAndGetToken("verify-expired@flow.test");
    await prisma.emailVerification.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await app.inject({ method: "POST", url: "/api/v1/auth/verify-email", payload: { token } });

    expect(res.statusCode).toBe(422);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "verify-expired@flow.test" } });
    expect(user.status).toBe("PENDING_VERIFICATION");
  });

  it("enforces verification consistently: blocked before, allowed after", async () => {
    const { token, password } = await registerAndGetToken("verify-then-login@flow.test");

    const before = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "verify-then-login@flow.test", password },
    });
    expect(before.statusCode).toBe(422);

    await app.inject({ method: "POST", url: "/api/v1/auth/verify-email", payload: { token } });

    const after = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "verify-then-login@flow.test", password },
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().data.accessToken).toBeTruthy();
  });
});
