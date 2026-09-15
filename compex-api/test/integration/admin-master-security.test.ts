import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createAdminAndLogin, createTestApp, cleanDb, makeTestPassword } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

async function createStaffAndLogin(email: string) {
  const password = makeTestPassword();
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 12), role: "STAFF", status: "ACTIVE", firstName: "Test", lastName: "Staff" },
  });
  const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } });
  return { id: user.id, accessToken: login.json().data.accessToken as string };
}

function adminHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

describe("admin user privilege boundaries", () => {
  it("returns 403 when STAFF tries to create ADMIN, allows an ADMIN, and ignores role on PATCH", async () => {
    const admin = await createAdminAndLogin(app, "admin-role-boundary@invalid.test");
    const staff = await createStaffAndLogin("staff-role-boundary@invalid.test");
    const adminInvite = { email: "new-admin@invalid.test", firstName: "New", lastName: "Admin", role: "ADMIN" };

    const forbidden = await app.inject({ method: "POST", url: "/api/v1/admin/users", headers: adminHeaders(staff.accessToken), payload: adminInvite });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("FORBIDDEN");

    const created = await app.inject({ method: "POST", url: "/api/v1/admin/users", headers: adminHeaders(admin.accessToken), payload: adminInvite });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.role).toBe("ADMIN");

    const escalation = await app.inject({ method: "PATCH", url: `/api/v1/admin/users/${staff.id}`, headers: adminHeaders(admin.accessToken), payload: { role: "ADMIN" } });
    expect(escalation.statusCode).toBe(200);
    expect(escalation.json().data.role).toBe("STAFF");
  });
});

describe("settings-backed customer data", () => {
  it("rejects explicit empty, unknown, and inactive values; accepts an active value; and redacts financial data from audit history", async () => {
    const admin = await createAdminAndLogin(app, "admin-customer-settings@invalid.test");
    const country = await prisma.setting.create({ data: { category: "COUNTRY", value: `Testland-${randomUUID().slice(0, 8)}` } });
    const base = { companyName: "Customer Settings QA", firstName: "Customer", lastName: "QA", phone: "9876543210" };

    const empty = await app.inject({ method: "POST", url: "/api/v1/admin/customers", headers: adminHeaders(admin.accessToken), payload: { ...base, email: "empty-country@invalid.test", country: "" } });
    expect(empty.statusCode).toBe(400);

    const invalid = await app.inject({ method: "POST", url: "/api/v1/admin/customers", headers: adminHeaders(admin.accessToken), payload: { ...base, email: "invalid-country@invalid.test", country: "Unknownland" } });
    expect(invalid.statusCode).toBe(400);

    const valid = await app.inject({ method: "POST", url: "/api/v1/admin/customers", headers: adminHeaders(admin.accessToken), payload: {
      ...base, email: "active-country@invalid.test", country: country.value, creditLimit: 50000, internalAccountNumber: "INTERNAL-123", shippingAccount: "SHIP-456", bankDetails: "Bank secret",
    } });
    expect(valid.statusCode).toBe(201);
    const customerId = valid.json().data.id as string;

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "customer.invited", entityId: customerId } });
    expect(audit.newValue).not.toHaveProperty("company.creditLimit");
    expect(audit.newValue).not.toHaveProperty("company.internalAccountNumber");
    expect(audit.newValue).not.toHaveProperty("company.shippingAccount");
    expect(audit.newValue).not.toHaveProperty("company.bankDetails");

    await prisma.setting.update({ where: { id: country.id }, data: { isActive: false } });
    const inactive = await app.inject({ method: "PATCH", url: `/api/v1/admin/customers/${customerId}`, headers: adminHeaders(admin.accessToken), payload: { country: country.value } });
    expect(inactive.statusCode).toBe(400);

    const optionalNull = await app.inject({ method: "PATCH", url: `/api/v1/admin/customers/${customerId}`, headers: adminHeaders(admin.accessToken), payload: { salesPersonId: null } });
    expect(optionalNull.statusCode).toBe(200);
  });

  it("exposes server-side GSTIN search and traverses records beyond 100", async () => {
    const admin = await createAdminAndLogin(app, "admin-customer-pagination@invalid.test");
    const records = await Promise.all(Array.from({ length: 101 }, (_, index) => prisma.customer.create({
      data: {
        accountNumber: `QA-${String(index).padStart(3, "0")}`,
        user: { create: { email: `customer-${index}@invalid.test`, passwordHash: "not-used", firstName: "Customer", lastName: String(index), status: "ACTIVE" } },
        company: { create: { name: `Customer ${index}`, gstin: index === 100 ? "GSTIN-SEARCH-101" : null } },
      },
    })));
    expect(records).toHaveLength(101);

    const thirdPage = await app.inject({ method: "GET", url: "/api/v1/admin/customers?page=3&limit=50", headers: adminHeaders(admin.accessToken) });
    expect(thirdPage.statusCode).toBe(200);
    expect(thirdPage.json().meta).toMatchObject({ total: 101, page: 3, limit: 50 });
    expect(thirdPage.json().data).toHaveLength(1);

    const gstin = await app.inject({ method: "GET", url: "/api/v1/admin/customers?q=GSTIN-SEARCH-101", headers: adminHeaders(admin.accessToken) });
    expect(gstin.statusCode).toBe(200);
    expect(gstin.json().meta.total).toBe(1);
    expect(gstin.json().data[0].company.gstin).toBe("GSTIN-SEARCH-101");
  });
});

describe("settings activation lifecycle", () => {
  it("keeps inactive values out of default lists and exposes them only when requested", async () => {
    const admin = await createAdminAndLogin(app, "admin-settings-lifecycle@invalid.test");
    const setting = await prisma.setting.create({ data: { category: "REGION", value: `QA-Inactive-${randomUUID().slice(0, 8)}` } });

    const deactivate = await app.inject({ method: "POST", url: `/api/v1/admin/settings/${setting.id}/deactivate`, headers: adminHeaders(admin.accessToken) });
    expect(deactivate.statusCode).toBe(200);
    expect(deactivate.json().data.isActive).toBe(false);

    const activeOnly = await app.inject({ method: "GET", url: "/api/v1/admin/settings?category=REGION", headers: adminHeaders(admin.accessToken) });
    expect(activeOnly.json().data).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: setting.id })]));
    const includingInactive = await app.inject({ method: "GET", url: "/api/v1/admin/settings?category=REGION&includeInactive=true", headers: adminHeaders(admin.accessToken) });
    expect(includingInactive.json().data).toEqual(expect.arrayContaining([expect.objectContaining({ id: setting.id, isActive: false })]));

    const activate = await app.inject({ method: "POST", url: `/api/v1/admin/settings/${setting.id}/activate`, headers: adminHeaders(admin.accessToken) });
    expect(activate.statusCode).toBe(200);
    expect(activate.json().data.isActive).toBe(true);
  });
});

describe("client-provided admin references", () => {
  it("rejects unknown product manufacturer and category IDs before attempting a write", async () => {
    const admin = await createAdminAndLogin(app, "admin-product-reference@invalid.test");
    const invalidManufacturer = await app.inject({
      method: "POST", url: "/api/v1/admin/products", headers: adminHeaders(admin.accessToken),
      payload: { mpn: "QA-UNKNOWN-MANUFACTURER", manufacturerId: "00000000-0000-4000-8000-000000000001" },
    });
    expect(invalidManufacturer.statusCode).toBe(400);
    expect(invalidManufacturer.json().error.code).toBe("VALIDATION_ERROR");

    const invalidCategory = await app.inject({
      method: "POST", url: "/api/v1/admin/products", headers: adminHeaders(admin.accessToken),
      payload: { mpn: "QA-UNKNOWN-CATEGORY", categoryId: "00000000-0000-4000-8000-000000000002" },
    });
    expect(invalidCategory.statusCode).toBe(400);
    expect(invalidCategory.json().error.code).toBe("VALIDATION_ERROR");
  });
});
