import { buildApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

function hasDedicatedTestDatabase(databaseUrl?: string): boolean {
  if (!databaseUrl) return false;

  try {
    const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
    return /_test$/i.test(databaseName);
  } catch {
    return false;
  }
}

export async function cleanDb() {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.ALLOW_INTEGRATION_DB_RESET !== "true" ||
    !hasDedicatedTestDatabase(process.env.DATABASE_URL)
  ) {
    throw new Error(
      "Refusing destructive integration cleanup. Set NODE_ENV=test, use a dedicated *_test database, and explicitly set ALLOW_INTEGRATION_DB_RESET=true.",
    );
  }

  // Delete in FK-safe order (children before parents)
  await prisma.testEmail.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.landedCost.deleteMany();
  await prisma.vendorQuote.deleteMany();
  await prisma.vendorRfqItem.deleteMany();
  await prisma.vendorRfq.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.manufacturer.deleteMany();
  await prisma.document.deleteMany();
  await prisma.rfqItem.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.rfq.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.accountSetupToken.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}

export async function registerAndLogin(
  app: FastifyInstance,
  email: string,
  suffix = "",
) {
  const password = makeTestPassword();
  await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      companyName: `TestCo ${suffix}`,
      firstName: "Test",
      lastName: "User",
      email,
      phone: "9876543210",
      password,
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
    payload: { email, password },
  });

  const body = res.json();
  return { accessToken: body.data.accessToken as string };
}

export function makeTestPassword(): string {
  return `A1${randomUUID().replaceAll("-", "")}`;
}

// No public registration path creates ADMIN/STAFF users — they're provisioned
// out-of-band (seed script / ops). Test-only equivalent: create the user
// directly, then log in through the real endpoint like any other user.
export async function createAdminAndLogin(app: FastifyInstance, email: string) {
  const bcrypt = await import("bcryptjs");
  const password = makeTestPassword();
  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "ADMIN",
      status: "ACTIVE",
      firstName: "Test",
      lastName: "Admin",
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });

  const body = res.json();
  return { accessToken: body.data.accessToken as string };
}
