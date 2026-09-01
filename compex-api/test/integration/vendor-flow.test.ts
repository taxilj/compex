import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, cleanDb, registerAndLogin, createAdminAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

async function setupRfqWithItem(customerToken: string) {
  const rfqRes = await app.inject({
    method: "POST", url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { priority: "MEDIUM" },
  });
  const rfqId = rfqRes.json().data.id as string;

  const itemRes = await app.inject({
    method: "POST", url: `/api/v1/rfqs/${rfqId}/items`,
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { mpn: "STM32F103C8T6", quantity: 100 },
  });
  const itemId = itemRes.json().data.id as string;

  return { rfqId, itemId };
}

const VENDOR_BODY = { name: "TechSource Electronics", contactEmail: "sales@techsource.test", contactPhone: "+911234567890" };
const MANUFACTURER_BODY = { name: "STMicroelectronics", slug: "stmicroelectronics" };

describe("Vendor CRUD", () => {
  it("admin can create, list, get, and update a vendor", async () => {
    const { accessToken } = await createAdminAndLogin(app, "admin1@compex-test.local");

    const create = await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: { authorization: `Bearer ${accessToken}` }, payload: VENDOR_BODY });
    expect(create.statusCode).toBe(201);
    const vendorId = create.json().data.id as string;

    const list = await app.inject({ method: "GET", url: "/api/v1/admin/vendors", headers: { authorization: `Bearer ${accessToken}` } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.length).toBe(1);

    const get = await app.inject({ method: "GET", url: `/api/v1/admin/vendors/${vendorId}`, headers: { authorization: `Bearer ${accessToken}` } });
    expect(get.statusCode).toBe(200);

    const patch = await app.inject({ method: "PATCH", url: `/api/v1/admin/vendors/${vendorId}`, headers: { authorization: `Bearer ${accessToken}` }, payload: { name: "TechSource Electronics Pvt Ltd" } });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data.name).toBe("TechSource Electronics Pvt Ltd");

    // Vendor create/update are audited (P1.1)
    const logs = await prisma.auditLog.findMany({ where: { entityType: "vendor", entityId: vendorId } });
    expect(logs.map((l) => l.action).sort()).toEqual(["vendor.created", "vendor.updated"]);
  });

  it("customer cannot access vendor endpoints", async () => {
    const { accessToken } = await registerAndLogin(app, "cust-vendor@compex-test.local");
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/vendors", headers: { authorization: `Bearer ${accessToken}` } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Manufacturer CRUD", () => {
  it("admin can create, list, and update a manufacturer", async () => {
    const { accessToken } = await createAdminAndLogin(app, "admin2@compex-test.local");

    const create = await app.inject({ method: "POST", url: "/api/v1/admin/manufacturers", headers: { authorization: `Bearer ${accessToken}` }, payload: MANUFACTURER_BODY });
    expect(create.statusCode).toBe(201);
    const mfrId = create.json().data.id as string;

    const patch = await app.inject({ method: "PATCH", url: `/api/v1/admin/manufacturers/${mfrId}`, headers: { authorization: `Bearer ${accessToken}` }, payload: { name: "STMicroelectronics N.V." } });
    expect(patch.statusCode).toBe(200);

    const logs = await prisma.auditLog.findMany({ where: { entityType: "manufacturer", entityId: mfrId } });
    expect(logs.map((l) => l.action).sort()).toEqual(["manufacturer.created", "manufacturer.updated"]);
  });

  it("customer cannot access manufacturer endpoints", async () => {
    const { accessToken } = await registerAndLogin(app, "cust-mfr@compex-test.local");
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/manufacturers", headers: { authorization: `Bearer ${accessToken}` } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Vendor RFQ + vendor quote", () => {
  it("admin can create a vendor RFQ, record a vendor quote, and retrieve both", async () => {
    const { accessToken: customerToken } = await registerAndLogin(app, "cust-vrfq@compex-test.local");
    const { accessToken: adminToken } = await createAdminAndLogin(app, "admin3@compex-test.local");
    const { rfqId, itemId } = await setupRfqWithItem(customerToken);

    const vendor = await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: { authorization: `Bearer ${adminToken}` }, payload: VENDOR_BODY });
    const vendorId = vendor.json().data.id as string;

    const vrfq = await app.inject({
      method: "POST", url: "/api/v1/admin/vendor-rfqs",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { rfqId, vendorId, itemIds: [itemId] },
    });
    expect(vrfq.statusCode).toBe(201);
    const vendorRfqId = vrfq.json().data.id as string;

    const get = await app.inject({ method: "GET", url: `/api/v1/admin/vendor-rfqs/${vendorRfqId}`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(get.statusCode).toBe(200);

    const quote = await app.inject({
      method: "POST", url: `/api/v1/admin/vendor-rfqs/${vendorRfqId}/quotes`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { rfqItemId: itemId, unitCost: 4.5, currency: "USD" },
    });
    expect(quote.statusCode).toBe(201);
    const quoteId = quote.json().data.id as string;

    // Vendor quote creation is audited transactionally (P1.1 + P2.1)
    const logs = await prisma.auditLog.findMany({ where: { entityType: "vendor_quote", entityId: quoteId } });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe("vendor_quote.created");
  });

  it("customer cannot access vendor-rfq endpoints", async () => {
    const { accessToken } = await registerAndLogin(app, "cust-vrfq2@compex-test.local");
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/vendor-rfqs", headers: { authorization: `Bearer ${accessToken}` } });
    expect(res.statusCode).toBe(403);
  });

  it("allows exactly one concurrent winning quote per RFQ line", async () => {
    const { accessToken: customerToken } = await registerAndLogin(app, "cust-vrfq-race@compex-test.local");
    const { accessToken: adminToken } = await createAdminAndLogin(app, "admin-race@compex-test.local");
    const { rfqId, itemId } = await setupRfqWithItem(customerToken);

    const firstVendor = await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: { authorization: `Bearer ${adminToken}` }, payload: VENDOR_BODY });
    const secondVendor = await app.inject({ method: "POST", url: "/api/v1/admin/vendors", headers: { authorization: `Bearer ${adminToken}` }, payload: { ...VENDOR_BODY, name: "Alternate TechSource", contactEmail: "alternate@techsource.test" } });
    const [firstRfq, secondRfq] = await Promise.all([firstVendor, secondVendor].map((vendor) => app.inject({
      method: "POST", url: "/api/v1/admin/vendor-rfqs", headers: { authorization: `Bearer ${adminToken}` },
      payload: { rfqId, vendorId: vendor.json().data.id, itemIds: [itemId] },
    })));
    const [firstQuote, secondQuote] = await Promise.all([firstRfq, secondRfq].map((vendorRfq) => app.inject({
      method: "POST", url: `/api/v1/admin/vendor-rfqs/${vendorRfq.json().data.id}/quotes`, headers: { authorization: `Bearer ${adminToken}` },
      payload: { rfqItemId: itemId, unitCost: 4.5, currency: "USD" },
    })));

    const results = await Promise.all([firstQuote, secondQuote].map((quote, index) => app.inject({
      method: "PATCH", url: `/api/v1/admin/vendor-rfqs/${[firstRfq, secondRfq][index].json().data.id}/quotes/${quote.json().data.id}`,
      headers: { authorization: `Bearer ${adminToken}` }, payload: { status: "SELECTED" },
    })));
    expect(results.filter((result) => result.statusCode === 200)).toHaveLength(1);
    expect(results.some((result) => result.statusCode === 409 || result.statusCode === 422)).toBe(true);
    expect(await prisma.vendorQuote.count({ where: { rfqItemId: itemId, status: "SELECTED" } })).toBe(1);
  });
});

describe("Positive admin authorization (P1.5)", () => {
  it("ADMIN succeeds on admin RFQ, vendor, vendor-rfq listing endpoints", async () => {
    const { accessToken } = await createAdminAndLogin(app, "admin4@compex-test.local");
    const rfqs = await app.inject({ method: "GET", url: "/api/v1/admin/rfqs", headers: { authorization: `Bearer ${accessToken}` } });
    expect(rfqs.statusCode).toBe(200);
    const vendors = await app.inject({ method: "GET", url: "/api/v1/admin/vendors", headers: { authorization: `Bearer ${accessToken}` } });
    expect(vendors.statusCode).toBe(200);
    const vendorRfqs = await app.inject({ method: "GET", url: "/api/v1/admin/vendor-rfqs", headers: { authorization: `Bearer ${accessToken}` } });
    expect(vendorRfqs.statusCode).toBe(200);
  });
});
