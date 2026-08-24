import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import type { FastifyInstance } from "fastify";

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function cleanDb() {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.ALLOW_INTEGRATION_DB_RESET !== "true" ||
    !process.env.DATABASE_URL?.includes("_test")
  ) {
    throw new Error(
      "Refusing destructive integration cleanup. Set NODE_ENV=test, use a dedicated *_test database, and explicitly set ALLOW_INTEGRATION_DB_RESET=true.",
    );
  }

  // Delete in FK-safe order
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.rfqItem.deleteMany();
  await prisma.rfq.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}

export async function registerAndLogin(
  app: FastifyInstance,
  email: string,
  suffix = "",
) {
  await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      companyName: `TestCo ${suffix}`,
      firstName: "Test",
      lastName: "User",
      email,
      phone: "9876543210",
      password: "TestPass1234!",
    },
  });

  // Manually activate user (skip email verification in tests)
  await prisma.user.update({
    where: { email },
    data: { status: "ACTIVE" },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: "TestPass1234!" },
  });

  const body = res.json();
  return { accessToken: body.data.accessToken as string };
}