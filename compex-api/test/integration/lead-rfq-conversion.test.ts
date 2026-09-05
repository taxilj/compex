import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { cleanDb, createAdminAndLogin, createTestApp, registerAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

describe("staff Lead-to-RFQ conversion", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanDb();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("links a public component enquiry to one customer-owned RFQ and carries the canonical product", async () => {
    const product = await prisma.product.create({
      data: { mpn: "CONVERT-QA-001", normalizedMpn: "CONVERTQA001", description: "Synthetic conversion test product" },
    });
    const enquiry = await app.inject({
      method: "POST",
      url: "/api/v1/leads",
      payload: {
        source: "REQUEST_QUOTE",
        contactName: "Conversion QA User",
        contactEmail: "lead-conversion@invalid.test",
        companyName: "Conversion QA Company",
        message: "Synthetic Lead-to-RFQ conversion test.",
        deliveryLocation: "QA City",
        requiredDate: "2026-12-31",
        items: [{ mpn: "convert qa 001", manufacturer: "QA Manufacturer", quantity: 7 }],
      },
    });
    expect(enquiry.statusCode).toBe(201);
    const referenceNumber = enquiry.json().data.referenceNumber as string;

    const { accessToken: customerToken } = await registerAndLogin(app, "conversion-customer@invalid.test", "Lead Conversion");
    const customer = await prisma.customer.findFirstOrThrow({
      where: { user: { email: "conversion-customer@invalid.test" } },
      select: { id: true },
    });
    const { accessToken: adminToken } = await createAdminAndLogin(app, "lead-conversion-admin@invalid.test");
    const lead = await prisma.lead.findUniqueOrThrow({ where: { referenceNumber }, select: { id: true } });

    const converted = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leads/${lead.id}/convert-to-rfq`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { customerId: customer.id },
    });
    expect(converted.statusCode).toBe(201);
    const data = converted.json().data;
    expect(data.lead.rfq.id).toBe(data.rfq.id);
    expect(data.rfq.sourcingStatus).toBe("NEW");
    expect(data.rfq.items).toEqual([
      expect.objectContaining({ mpn: "convert qa 001", quantity: 7, productId: product.id }),
    ]);

    const customerView = await app.inject({
      method: "GET",
      url: `/api/v1/rfqs/${data.rfq.id}`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(customerView.statusCode).toBe(200);
    expect(customerView.json().data).not.toHaveProperty("sourcingStatus");

    const persisted = await prisma.lead.findUniqueOrThrow({
      where: { id: lead.id },
      select: {
        customerId: true,
        rfq: {
          select: {
            id: true,
            customerId: true,
            items: { select: { productId: true, mpn: true, quantity: true } },
          },
        },
      },
    });
    expect(persisted.customerId).toBe(customer.id);
    expect(persisted.rfq).toMatchObject({ id: data.rfq.id, customerId: customer.id });
    expect(persisted.rfq?.items).toEqual([expect.objectContaining({ productId: product.id, mpn: "convert qa 001", quantity: 7 })]);

    const repeated = await app.inject({
      method: "POST",
      url: `/api/v1/admin/leads/${lead.id}/convert-to-rfq`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { customerId: customer.id },
    });
    expect(repeated.statusCode).toBe(409);
  });
});
