import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDb, createAdminAndLogin, createTestApp, registerAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;
beforeAll(async () => { app = await createTestApp(); });
beforeEach(async () => { await cleanDb(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });

describe("partial updates after validation-library upgrade", () => {
  it("preserves nondefault landed-cost amounts when only notes change", async () => {
    const admin = await createAdminAndLogin(app, "partial-admin@invalid.test");
    const customer = await registerAndLogin(app, "partial-customer@invalid.test");
    const rfq = await app.inject({ method: "POST", url: "/api/v1/rfqs", headers: { authorization: `Bearer ${customer.accessToken}` }, payload: {} });
    expect(rfq.statusCode).toBe(201);
    const vendor = await prisma.vendor.create({ data: { name: "Synthetic Partial Vendor", contactEmail: "partial-vendor@invalid.test" } });
    const vrfq = await prisma.vendorRfq.create({ data: { vendorRfqNumber: `QA-${randomUUID()}`, rfqId: rfq.json().data.id, vendorId: vendor.id } });
    const headers = { authorization: `Bearer ${admin.accessToken}` };
    const url = `/api/v1/admin/vendor-rfqs/${vrfq.id}/landed-cost`;
    const created = await app.inject({ method: "POST", url, headers, payload: { quantity: 10, currency: "USD", exchangeRate: 80, shipping: 12, insurance: 3, customsDuty: 4, igst: 5, handling: 6, otherCosts: 7, marginPercent: 25 } });
    expect(created.statusCode).toBe(201);
    const patched = await app.inject({ method: "PATCH", url, headers, payload: { notes: "Only this changes" } });
    expect(patched.statusCode).toBe(200);
    for (const key of ["quantity", "currency", "exchangeRate", "shipping", "insurance", "customsDuty", "igst", "handling", "otherCosts", "marginPercent", "landedCost", "customerPrice"]) {
      expect(patched.json().data[key]).toEqual(created.json().data[key]);
    }
    expect(patched.json().data.notes).toBe("Only this changes");
  });

  it("preserves organization currency and retired setting state on unrelated edits", async () => {
    const admin = await createAdminAndLogin(app, "partial-master-admin@invalid.test");
    const headers = { authorization: `Bearer ${admin.accessToken}` };
    const org = await app.inject({ method: "POST", url: "/api/v1/admin/organizations", headers, payload: { companyName: "Synthetic Partial Organization", shortName: "QA", currency: "USD" } });
    expect(org.statusCode).toBe(201);
    const patched = await app.inject({ method: "PATCH", url: `/api/v1/admin/organizations/${org.json().data.id}`, headers, payload: { address: "Synthetic address" } });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().data.currency).toBe("USD");
    const setting = await prisma.setting.create({ data: { category: "QA_PARTIAL", value: randomUUID(), sortOrder: 17, isActive: false } });
    try {
      const result = await app.inject({ method: "PATCH", url: `/api/v1/admin/settings/${setting.id}`, headers, payload: { sortOrder: 18 } });
      expect(result.statusCode).toBe(200);
      expect(result.json().data).toMatchObject({ isActive: false, isEditable: true, sortOrder: 18 });
    } finally {
      await prisma.setting.delete({ where: { id: setting.id } });
    }
  });
});
