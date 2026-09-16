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

it("creates, reads, and updates the company's own phone number (distinct from the portal contact's phone)", async () => {
  const admin = await createAdminAndLogin(app, "admin-company-phone@invalid.test");
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/admin/customers",
    headers: { authorization: `Bearer ${admin.accessToken}` },
    payload: {
      companyName: "Compex Phone QA Company",
      firstName: "Phone",
      lastName: "QA",
      email: "company-phone@invalid.test",
      phone: "9876543210", // the portal contact's own phone (User.phone)
      companyPhone: "022-55501000", // the company's own business phone (Company.phone)
    },
  });
  expect(created.statusCode).toBe(201);
  const customerId = created.json().data.id as string;
  expect(created.json().data.user.phone).toBe("9876543210");
  expect(created.json().data.company.phone).toBe("022-55501000");

  const read = await app.inject({
    method: "GET",
    url: `/api/v1/admin/customers/${customerId}`,
    headers: { authorization: `Bearer ${admin.accessToken}` },
  });
  expect(read.statusCode).toBe(200);
  expect(read.json().data.company.phone).toBe("022-55501000");
  expect(read.json().data.user.phone).toBe("9876543210");

  const updated = await app.inject({
    method: "PATCH",
    url: `/api/v1/admin/customers/${customerId}`,
    headers: { authorization: `Bearer ${admin.accessToken}` },
    payload: { companyPhone: "022-55501999" },
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json().data.company.phone).toBe("022-55501999");
  // Updating the company phone must never touch the distinct User.phone field.
  expect(updated.json().data.user.phone).toBe("9876543210");

  const reread = await app.inject({
    method: "GET",
    url: `/api/v1/admin/customers/${customerId}`,
    headers: { authorization: `Bearer ${admin.accessToken}` },
  });
  expect(reread.json().data.company.phone).toBe("022-55501999");
});
