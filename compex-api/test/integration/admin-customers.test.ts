import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createAdminAndLogin, createTestApp, cleanDb, makeTestPassword } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

it("allows an admin to invite a customer, requires one-time setup, and blocks customer administration", async () => {
  const admin = await createAdminAndLogin(app, "admin-customer-flow@invalid.test");
  const invitation = await app.inject({
    method: "POST",
    url: "/api/v1/admin/customers",
    headers: { authorization: `Bearer ${admin.accessToken}` },
    payload: {
      companyName: "Compex QA Demo Company",
      firstName: "Compex",
      lastName: "QA Customer",
      email: "customer-flow@invalid.test",
      phone: "9876543210",
      city: "QA City",
    },
  });

  expect(invitation.statusCode).toBe(201);
  expect(invitation.json().data).not.toHaveProperty("password");
  expect(invitation.json().data).not.toHaveProperty("token");

  const outbox = await app.inject({
    method: "GET",
    url: "/api/v1/test/email-outbox",
    headers: { authorization: `Bearer ${admin.accessToken}` },
  });
  expect(outbox.statusCode).toBe(200);
  const actionUrl = outbox.json().data[0].actionUrl as string;
  const token = new URL(actionUrl).searchParams.get("token");
  expect(token).toBeTruthy();

  const password = makeTestPassword();
  const setup = await app.inject({ method: "POST", url: "/api/v1/auth/complete-account-setup", payload: { token, password } });
  expect(setup.statusCode).toBe(200);
  const reused = await app.inject({ method: "POST", url: "/api/v1/auth/complete-account-setup", payload: { token, password } });
  expect(reused.statusCode).toBe(404);

  const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "customer-flow@invalid.test", password } });
  expect(login.statusCode).toBe(200);
  const customerToken = login.json().data.accessToken as string;
  const forbidden = await app.inject({ method: "GET", url: "/api/v1/admin/customers", headers: { authorization: `Bearer ${customerToken}` } });
  expect(forbidden.statusCode).toBe(403);

  const audit = await prisma.auditLog.findMany({ where: { action: { in: ["customer.invited", "customer.account_activated"] } } });
  expect(audit).toHaveLength(2);
});
