import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createAdminAndLogin, createTestApp, cleanDb } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";
import { sendEmail } from "../../src/lib/email.js";

// Pass-through by default; individual tests make the provider fail.
vi.mock("../../src/lib/email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/email.js")>();
  return { ...actual, sendEmail: vi.fn(actual.sendEmail) };
});

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const unique = (label: string) => `${label}-${randomUUID().slice(0, 8)}`;

describe("audit redaction", () => {
  it("never writes bank, credit, or shipping-account data for vendors to the audit log", async () => {
    const admin = await createAdminAndLogin(app, "admin-vendor-audit@invalid.test");
    const created = await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: auth(admin.accessToken), payload: { name: "Audit V", contactEmail: "auditv@invalid.test", bankDetails: "IBAN-SECRET-V1", creditLimit: 313131, shippingAccount: "SHIP-SECRET-V1" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id as string;
    await app.inject({ method: "PATCH", url: `/api/v1/admin/vendors/${id}`, headers: auth(admin.accessToken), payload: { bankDetails: "IBAN-SECRET-V2", creditLimit: 424242, shippingAccount: "SHIP-SECRET-V2" } });

    const audit = JSON.stringify(await prisma.auditLog.findMany());
    for (const secret of ["IBAN-SECRET", "313131", "424242", "SHIP-SECRET"]) expect(audit).not.toContain(secret);
    expect(audit).toContain("vendor.created");
  });
});

describe("activate / deactivate audit records what changed", () => {
  it("records isActive before and after for vendors and manufacturers", async () => {
    const admin = await createAdminAndLogin(app, "admin-toggle-audit@invalid.test");
    const vendor = (await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: auth(admin.accessToken), payload: { name: "Toggle V", contactEmail: "togglev@invalid.test" } })).json().data.id as string;
    const mfr = (await app.inject({ method: "POST", url: "/api/v1/admin/manufacturers", headers: auth(admin.accessToken), payload: { name: "Toggle M", slug: unique("toggle-m") } })).json().data.id as string;

    await app.inject({ method: "POST", url: `/api/v1/admin/vendors/${vendor}/deactivate`, headers: auth(admin.accessToken) });
    await app.inject({ method: "POST", url: `/api/v1/admin/vendors/${vendor}/activate`, headers: auth(admin.accessToken) });
    await app.inject({ method: "POST", url: `/api/v1/admin/manufacturers/${mfr}/deactivate`, headers: auth(admin.accessToken) });

    const row = (action: string) => prisma.auditLog.findFirstOrThrow({ where: { action } });
    expect(await row("vendor.deactivated")).toMatchObject({ oldValue: { isActive: true }, newValue: { isActive: false } });
    expect(await row("vendor.activated")).toMatchObject({ oldValue: { isActive: false }, newValue: { isActive: true } });
    expect(await row("manufacturer.deactivated")).toMatchObject({ oldValue: { isActive: true }, newValue: { isActive: false } });
  });
});

describe("boolean query filters", () => {
  it("returns only hidden products for isActive=false and only active ones for isActive=true", async () => {
    const admin = await createAdminAndLogin(app, "admin-filter@invalid.test");
    const visible = (await app.inject({ method: "POST", url: "/api/v1/admin/products", headers: auth(admin.accessToken), payload: { mpn: unique("VIS") } })).json().data.id as string;
    const hidden = (await app.inject({ method: "POST", url: "/api/v1/admin/products", headers: auth(admin.accessToken), payload: { mpn: unique("HID") } })).json().data.id as string;
    await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${hidden}`, headers: auth(admin.accessToken), payload: { isActive: false } });

    const ids = async (query: string) => (await app.inject({ method: "GET", url: `/api/v1/admin/products?${query}`, headers: auth(admin.accessToken) })).json().data.map((p: { id: string }) => p.id) as string[];
    expect(await ids("isActive=false")).toEqual([hidden]);
    expect(await ids("isActive=true")).toEqual([visible]);
    expect((await ids("")).sort()).toEqual([visible, hidden].sort());
  });

  it("treats includeInactive=false on Settings as false", async () => {
    const admin = await createAdminAndLogin(app, "admin-include@invalid.test");
    const value = unique("Retired");
    await prisma.setting.create({ data: { category: "UOM", value, isActive: false } });
    const list = async (q: string) => (await app.inject({ method: "GET", url: `/api/v1/admin/settings?category=UOM${q}`, headers: auth(admin.accessToken) })).json().data.map((s: { value: string }) => s.value) as string[];
    expect(await list("&includeInactive=false")).not.toContain(value);
    expect(await list("&includeInactive=true")).toContain(value);
  });
});

describe("Company phone is independent of User.phone", () => {
  it("clearing only companyPhone leaves the portal contact's phone intact", async () => {
    const admin = await createAdminAndLogin(app, "admin-phone-clear@invalid.test");
    const created = await app.inject({ method: "POST", url: "/api/v1/admin/customers", headers: auth(admin.accessToken), payload: { companyName: "Phone C", firstName: "P", lastName: "C", email: "phonec@invalid.test", phone: "9876543210", companyPhone: "022-55501000" } });
    const id = created.json().data.id as string;
    const cleared = await app.inject({ method: "PATCH", url: `/api/v1/admin/customers/${id}`, headers: auth(admin.accessToken), payload: { companyPhone: null } });
    expect(cleared.statusCode).toBe(200);
    const reread = await app.inject({ method: "GET", url: `/api/v1/admin/customers/${id}`, headers: auth(admin.accessToken) });
    expect(reread.json().data.company.phone).toBeNull();
    expect(reread.json().data.user.phone).toBe("9876543210");
  });
});

describe("failed invitations leave an honest audit trail", () => {
  it("records user.invite_failed, removes the user, and still reports a 503 when the email provider fails", async () => {
    const admin = await createAdminAndLogin(app, "admin-invite-fail@invalid.test");
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("provider down"));
    const res = await app.inject({ method: "POST", url: "/api/v1/admin/users", headers: auth(admin.accessToken), payload: { email: "never-delivered@invalid.test", firstName: "N", lastName: "D" } });
    expect(res.statusCode).toBe(503);
    expect(await prisma.user.findUnique({ where: { email: "never-delivered@invalid.test" } })).toBeNull();
    expect((await prisma.auditLog.findMany()).map((a) => a.action)).toContain("user.invite_failed");
  });

  it("records customer.invite_failed and removes the customer when the email provider fails", async () => {
    const admin = await createAdminAndLogin(app, "admin-cust-invite-fail@invalid.test");
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("provider down"));
    const res = await app.inject({ method: "POST", url: "/api/v1/admin/customers", headers: auth(admin.accessToken), payload: { companyName: "Never C", firstName: "N", lastName: "C", email: "never-cust@invalid.test" } });
    expect(res.statusCode).toBe(503);
    expect(await prisma.user.findUnique({ where: { email: "never-cust@invalid.test" } })).toBeNull();
    expect((await prisma.auditLog.findMany()).map((a) => a.action)).toContain("customer.invite_failed");
  });
});
