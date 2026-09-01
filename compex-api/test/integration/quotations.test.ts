import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, cleanDb, registerAndLogin, createAdminAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

async function setupRfq(customerToken: string) {
  const rfqRes = await app.inject({
    method: "POST", url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${customerToken}` },
    payload: { priority: "MEDIUM" },
  });
  return { rfqId: rfqRes.json().data.id as string };
}

async function createQuotation(adminToken: string, rfqId: string, customerId: string) {
  const res = await app.inject({
    method: "POST", url: "/api/v1/admin/quotations",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      rfqId, customerId, currency: "INR",
      validUntil: "2027-01-01",
      items: [{ lineNumber: 1, mpn: "STM32F103C8T6", quantity: 100, unitPrice: 12.5, taxRate: 18 }],
    },
  });
  return res;
}

describe("Quotation creation, retrieval, send (admin)", () => {
  it("admin creates, retrieves, and sends a quotation", async () => {
    const { accessToken: customerToken } = await registerAndLogin(app, "cust-quo1@compex-test.local");
    const { accessToken: adminToken } = await createAdminAndLogin(app, "admin-quo1@compex-test.local");
    const { rfqId } = await setupRfq(customerToken);
    const customerId = (await prisma.customer.findFirstOrThrow()).id;

    const create = await createQuotation(adminToken, rfqId, customerId);
    expect(create.statusCode).toBe(201);
    const quotationId = create.json().data.id as string;

    const get = await app.inject({ method: "GET", url: `/api/v1/admin/quotations/${quotationId}`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(get.statusCode).toBe(200);
    expect(get.json().data.status).toBe("DRAFT");

    const send = await app.inject({ method: "POST", url: `/api/v1/admin/quotations/${quotationId}/send`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(send.statusCode).toBe(200);
    expect(send.json().data.status).toBe("SENT");

    // create + send are audited transactionally (P2.1)
    const logs = await prisma.auditLog.findMany({ where: { entityType: "quotation", entityId: quotationId } });
    expect(logs.map((l) => l.action).sort()).toEqual(["quotation.created", "quotation.sent"]);
  });

  it("customer cannot access admin quotation management endpoints", async () => {
    const { accessToken } = await registerAndLogin(app, "cust-quo2@compex-test.local");
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/quotations", headers: { authorization: `Bearer ${accessToken}` } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Customer quotation view, accept, reject", () => {
  async function setupSentQuotation(customerEmail: string) {
    const { accessToken: customerToken } = await registerAndLogin(app, customerEmail);
    const { accessToken: adminToken } = await createAdminAndLogin(app, `admin-${customerEmail}`);
    const { rfqId } = await setupRfq(customerToken);
    const customerId = (await prisma.customer.findFirstOrThrow()).id;
    const create = await createQuotation(adminToken, rfqId, customerId);
    const quotationId = create.json().data.id as string;
    await app.inject({ method: "POST", url: `/api/v1/admin/quotations/${quotationId}/send`, headers: { authorization: `Bearer ${adminToken}` } });
    return { customerToken, quotationId };
  }

  it("customer can view a sent quotation (transitions to VIEWED) without vendor cost/margin fields", async () => {
    const { customerToken, quotationId } = await setupSentQuotation("cust-quo3@compex-test.local");

    const view = await app.inject({ method: "GET", url: `/api/v1/quotes/${quotationId}`, headers: { authorization: `Bearer ${customerToken}` } });
    expect(view.statusCode).toBe(200);
    const data = view.json().data;
    expect(data.status).toBe("VIEWED");

    // Vendor cost / margin / internal fields must never appear in the customer-facing shape
    const serialized = JSON.stringify(data);
    for (const forbidden of ["unitCost", "vendorCost", "marginPercent", "landedCost", "productCost"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("customer can accept a sent quotation", async () => {
    const { customerToken, quotationId } = await setupSentQuotation("cust-quo4@compex-test.local");
    const accept = await app.inject({ method: "POST", url: `/api/v1/quotes/${quotationId}/accept`, headers: { authorization: `Bearer ${customerToken}` } });
    expect(accept.statusCode).toBe(200);
    expect(accept.json().data.status).toBe("ACCEPTED");
  });

  it("customer can reject a sent quotation with a reason, and the reason is stored", async () => {
    const { customerToken, quotationId } = await setupSentQuotation("cust-quo5@compex-test.local");
    const reject = await app.inject({
      method: "POST", url: `/api/v1/quotes/${quotationId}/reject`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: "Price too high" },
    });
    expect(reject.statusCode).toBe(200);
    expect(reject.json().data.status).toBe("REJECTED");
    expect(reject.json().data.rejectionReason).toBe("Price too high");
  });

  it("rejects invalid status transition: cannot accept an already-ACCEPTED quotation", async () => {
    const { customerToken, quotationId } = await setupSentQuotation("cust-quo6@compex-test.local");
    await app.inject({ method: "POST", url: `/api/v1/quotes/${quotationId}/accept`, headers: { authorization: `Bearer ${customerToken}` } });
    const second = await app.inject({ method: "POST", url: `/api/v1/quotes/${quotationId}/accept`, headers: { authorization: `Bearer ${customerToken}` } });
    expect(second.statusCode).toBe(422);
  });

  it("customer cannot modify quotation internal fields (no PATCH route exposed to customers)", async () => {
    const { customerToken, quotationId } = await setupSentQuotation("cust-quo7@compex-test.local");
    const patch = await app.inject({
      method: "PATCH", url: `/api/v1/quotes/${quotationId}`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { total: 1 },
    });
    expect(patch.statusCode).toBe(404); // no PATCH route exists on the customer quotes router
  });

  it("customer cannot accept/view another customer's quotation (tenant isolation)", async () => {
    const { quotationId } = await setupSentQuotation("cust-quo8-owner@compex-test.local");
    const { accessToken: otherToken } = await registerAndLogin(app, "cust-quo8-other@compex-test.local");
    const res = await app.inject({ method: "GET", url: `/api/v1/quotes/${quotationId}`, headers: { authorization: `Bearer ${otherToken}` } });
    expect(res.statusCode).toBe(403);
  });
});
