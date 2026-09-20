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

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
// cleanDb() leaves `settings` alone (reference data), so every test uses
// uniquely named values instead of mutating shared ones.
const unique = (label: string) => `${label}-${randomUUID().slice(0, 8)}`;
const setting = (category: string, value: string, isActive = true) =>
  prisma.setting.upsert({ where: { category_value: { category, value } }, update: { isActive }, create: { category, value, isActive } });

async function staffAndLogin(email: string) {
  const password = makeTestPassword();
  await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), role: "STAFF", status: "ACTIVE", firstName: "Test", lastName: "Staff" } });
  const res = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email, password } });
  return { accessToken: res.json().data.accessToken as string };
}

describe("STAFF cannot modify ADMIN accounts", () => {
  it("returns 403 for email change and suspension of an ADMIN, leaving the account untouched", async () => {
    const staff = await staffAndLogin("staff-vs-admin@invalid.test");
    await createAdminAndLogin(app, "target-admin@invalid.test");
    const target = await prisma.user.findUniqueOrThrow({ where: { email: "target-admin@invalid.test" } });

    const takeover = await app.inject({ method: "PATCH", url: `/api/v1/admin/users/${target.id}`, headers: auth(staff.accessToken), payload: { email: "attacker@invalid.test" } });
    const suspend = await app.inject({ method: "PATCH", url: `/api/v1/admin/users/${target.id}`, headers: auth(staff.accessToken), payload: { status: "SUSPENDED" } });
    expect([takeover.statusCode, suspend.statusCode]).toEqual([403, 403]);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(after).toMatchObject({ email: "target-admin@invalid.test", status: "ACTIVE" });
  });

  it("still lets STAFF edit non-admin users and lets an ADMIN edit an ADMIN", async () => {
    const staff = await staffAndLogin("staff-ok@invalid.test");
    const admin = await createAdminAndLogin(app, "admin-ok@invalid.test");
    const peer = await prisma.user.create({ data: { email: "peer@invalid.test", passwordHash: "x", role: "STAFF", status: "ACTIVE", firstName: "P", lastName: "Eer" } });
    const adminRow = await prisma.user.findUniqueOrThrow({ where: { email: "admin-ok@invalid.test" } });

    expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/users/${peer.id}`, headers: auth(staff.accessToken), payload: { mobile: "9876543210" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/users/${adminRow.id}`, headers: auth(admin.accessToken), payload: { mobile: "9876543211" } })).statusCode).toBe(200);
  });
});

describe("clearing optional fields", () => {
  it("turns an explicit null into a real NULL for plain and Settings-backed vendor fields", async () => {
    const admin = await createAdminAndLogin(app, "admin-clear-vendor@invalid.test");
    const terms = unique("Net");
    await setting("PAYMENT_TERMS", terms);
    const created = await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: auth(admin.accessToken), payload: { name: "Clear V", contactEmail: "clearv@invalid.test", website: "https://example.com", paymentTerms: terms, mov: 500 } });
    const id = created.json().data.id as string;

    const cleared = await app.inject({ method: "PATCH", url: `/api/v1/admin/vendors/${id}`, headers: auth(admin.accessToken), payload: { website: null, paymentTerms: null, mov: null } });
    expect(cleared.statusCode).toBe(200);
    expect(await prisma.vendor.findUniqueOrThrow({ where: { id } })).toMatchObject({ website: null, paymentTerms: null, mov: null });
  });

  it("does not let null blank out a required field", async () => {
    const admin = await createAdminAndLogin(app, "admin-required@invalid.test");
    const created = await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: auth(admin.accessToken), payload: { name: "Required V", contactEmail: "reqv@invalid.test" } });
    const id = created.json().data.id as string;
    const res = await app.inject({ method: "PATCH", url: `/api/v1/admin/vendors/${id}`, headers: auth(admin.accessToken), payload: { name: null } });
    expect(res.statusCode).toBe(400);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id } })).name).toBe("Required V");
  });

  it("clears manufacturer fields, customer company/user phones, and user profile fields", async () => {
    const admin = await createAdminAndLogin(app, "admin-clear-all@invalid.test");

    const mfr = await app.inject({ method: "POST", url: "/api/v1/admin/manufacturers", headers: auth(admin.accessToken), payload: { name: "Clear M", slug: unique("clear-m"), remarks: "temp", stockCheckLink: "https://example.com/s" } });
    const mfrId = mfr.json().data.id as string;
    expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/manufacturers/${mfrId}`, headers: auth(admin.accessToken), payload: { remarks: null, stockCheckLink: null } })).statusCode).toBe(200);
    expect(await prisma.manufacturer.findUniqueOrThrow({ where: { id: mfrId } })).toMatchObject({ remarks: null, stockCheckLink: null });

    const cust = await app.inject({ method: "POST", url: "/api/v1/admin/customers", headers: auth(admin.accessToken), payload: { companyName: "Clear C", firstName: "A", lastName: "B", email: "clearc@invalid.test", phone: "9876543210", companyPhone: "9123456780", remarks: "temp" } });
    const custId = cust.json().data.id as string;
    const patched = await app.inject({ method: "PATCH", url: `/api/v1/admin/customers/${custId}`, headers: auth(admin.accessToken), payload: { phone: null, companyPhone: null, remarks: null } });
    expect(patched.statusCode).toBe(200);
    const row = await prisma.customer.findUniqueOrThrow({ where: { id: custId }, include: { user: true, company: true } });
    expect({ userPhone: row.user.phone, companyPhone: row.company.phone, remarks: row.company.remarks }).toEqual({ userPhone: null, companyPhone: null, remarks: null });

    const user = await app.inject({ method: "POST", url: "/api/v1/admin/users", headers: auth(admin.accessToken), payload: { email: "clearu@invalid.test", firstName: "C", lastName: "U", skype: "handle", remarks: "temp" } });
    const userId = user.json().data.id as string;
    expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/users/${userId}`, headers: auth(admin.accessToken), payload: { skype: null, remarks: null } })).statusCode).toBe(200);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ skype: null, remarks: null });
  });

  it("keeps rejecting an explicit empty string for a Settings-backed field (only null clears)", async () => {
    const admin = await createAdminAndLogin(app, "admin-empty@invalid.test");
    const created = await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: auth(admin.accessToken), payload: { name: "Empty V", contactEmail: "emptyv@invalid.test" } });
    const id = created.json().data.id as string;
    const res = await app.inject({ method: "PATCH", url: `/api/v1/admin/vendors/${id}`, headers: auth(admin.accessToken), payload: { paymentTerms: "" } });
    expect(res.statusCode).toBe(400);
  });
});

describe("products: HS codes, retired values, and manufacturer-aware MPN clashes", () => {
  it("validates hsCode / hsDescription against Settings", async () => {
    const admin = await createAdminAndLogin(app, "admin-hs@invalid.test");
    const code = unique("8542");
    const desc = unique("Diodes");
    await setting("HSN_CODE", code);
    await setting("SUB_CATEGORY_HS_DESC", desc);
    const created = await app.inject({ method: "POST", url: "/api/v1/admin/products", headers: auth(admin.accessToken), payload: { mpn: unique("HS") } });
    const id = created.json().data.id as string;

    expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${id}`, headers: auth(admin.accessToken), payload: { hsCode: "0000-not-real" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${id}`, headers: auth(admin.accessToken), payload: { hsDescription: "Not a real description" } })).statusCode).toBe(400);
    const ok = await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${id}`, headers: auth(admin.accessToken), payload: { hsCode: code, hsDescription: desc } });
    expect(ok.statusCode).toBe(200);
  });

  it("lets a product holding a since-retired Settings value be edited when that field is not resubmitted, but rejects resubmitting it", async () => {
    const admin = await createAdminAndLogin(app, "admin-retired@invalid.test");
    const packaging = unique("REEL");
    const row = await setting("PACKAGING", packaging);
    const created = await app.inject({ method: "POST", url: "/api/v1/admin/products", headers: auth(admin.accessToken), payload: { mpn: unique("RET"), packaging } });
    const id = created.json().data.id as string;
    await prisma.setting.update({ where: { id: row.id }, data: { isActive: false } });

    const unrelated = await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${id}`, headers: auth(admin.accessToken), payload: { name: "Renamed" } });
    expect(unrelated.statusCode).toBe(200);
    expect(unrelated.json().data.packaging).toBe(packaging);

    const resubmit = await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${id}`, headers: auth(admin.accessToken), payload: { packaging } });
    expect(resubmit.statusCode).toBe(400);

    const clear = await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${id}`, headers: auth(admin.accessToken), payload: { packaging: null } });
    expect(clear.statusCode).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).packaging).toBeNull();
  });

  it("treats clearing the manufacturer as manufacturerId=null for the MPN clash check", async () => {
    const admin = await createAdminAndLogin(app, "admin-clash@invalid.test");
    const mfr = await app.inject({ method: "POST", url: "/api/v1/admin/manufacturers", headers: auth(admin.accessToken), payload: { name: "Clash M", slug: unique("clash-m") } });
    const mpn = unique("CLASH");
    await app.inject({ method: "POST", url: "/api/v1/admin/products", headers: auth(admin.accessToken), payload: { mpn } });
    const withMfr = await app.inject({ method: "POST", url: "/api/v1/admin/products", headers: auth(admin.accessToken), payload: { mpn, manufacturerId: mfr.json().data.id } });
    expect(withMfr.statusCode).toBe(201);

    const clearMfr = await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${withMfr.json().data.id}`, headers: auth(admin.accessToken), payload: { manufacturerId: null } });
    expect(clearMfr.statusCode).toBe(409);
  });
});

describe("Customer Master Settings categories exist after migration", () => {
  it("has the four categories the forms depend on, with the spec's Customer/Vendor/Both values", async () => {
    const rows = await prisma.setting.findMany({ where: { category: { in: ["RELATIONSHIP_TYPE", "STATE", "INDUSTRY_SEGMENT", "BUSINESS_TYPE"] }, isActive: true } });
    const byCategory = (c: string) => rows.filter((r) => r.category === c).map((r) => r.value);
    expect(byCategory("RELATIONSHIP_TYPE")).toEqual(expect.arrayContaining(["Customer", "Vendor", "Both"]));
    for (const c of ["STATE", "INDUSTRY_SEGMENT", "BUSINESS_TYPE"]) expect(byCategory(c).length, c).toBeGreaterThan(0);
  });
});
