import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, cleanDb, registerAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

// CRITICAL SECURITY TESTS: Customer A must NEVER see Customer B's data

it("Customer A can read their own RFQ", async () => {
  const { accessToken } = await registerAndLogin(app, "a@test.com", "A");

  const rfqRes = await app.inject({
    method: "POST",
    url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { deliveryLocation: "Mumbai" },
  });
  const rfqId = rfqRes.json().data.id;

  const getRes = await app.inject({
    method: "GET",
    url: `/api/v1/rfqs/${rfqId}`,
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(getRes.statusCode).toBe(200);
  expect(getRes.json().data.id).toBe(rfqId);
});

it("Customer B CANNOT read Customer A RFQ — returns 404 not 403", async () => {
  const a = await registerAndLogin(app, "a@test.com", "A");
  const b = await registerAndLogin(app, "b@test.com", "B");

  // Customer A creates an RFQ
  const rfqRes = await app.inject({
    method: "POST",
    url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${a.accessToken}` },
    payload: { deliveryLocation: "Mumbai" },
  });
  const rfqId = rfqRes.json().data.id;

  // Customer B tries to access it
  const getRes = await app.inject({
    method: "GET",
    url: `/api/v1/rfqs/${rfqId}`,
    headers: { authorization: `Bearer ${b.accessToken}` },
  });
  // Must be 404 — not 403 (which would confirm the resource exists)
  expect(getRes.statusCode).toBe(404);
});

it("Customer B cannot see Customer A RFQ in list", async () => {
  const a = await registerAndLogin(app, "a@test.com", "A");
  const b = await registerAndLogin(app, "b@test.com", "B");

  await app.inject({
    method: "POST",
    url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${a.accessToken}` },
    payload: {},
  });

  const listRes = await app.inject({
    method: "GET",
    url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${b.accessToken}` },
  });
  expect(listRes.statusCode).toBe(200);
  expect(listRes.json().data).toHaveLength(0);
});

it("Customer B cannot access Customer A document", async () => {
  const a = await registerAndLogin(app, "a@test.com", "A");
  const b = await registerAndLogin(app, "b@test.com", "B");

  // Create a document owned by Customer A
  const aUser = await prisma.user.findUnique({ where: { email: "a@test.com" }, include: { customer: true } });
  const doc = await prisma.document.create({
    data: {
      customerId: aUser!.customer!.id,
      documentType: "BOM",
      fileName: "bom.xlsx",
      storageKey: "bom/test/test.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileSizeBytes: 100,
      processingStatus: "UPLOADED",
    },
  });

  const res = await app.inject({
    method: "GET",
    url: `/api/v1/documents/${doc.id}/download`,
    headers: { authorization: `Bearer ${b.accessToken}` },
  });
  expect(res.statusCode).toBe(404);
});