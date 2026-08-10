import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, cleanDb, registerAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  app = await createTestApp();
  await cleanDb();
  ({ accessToken: token } = await registerAndLogin(app, "rfq@test.com", "RFQ"));
});
afterAll(async () => { await app.close(); await prisma.$disconnect(); });

// 5. Customer creates RFQ
it("creates RFQ with valid data", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${token}` },
    payload: { deliveryLocation: "Pune", priority: "HIGH" },
  });
  expect(res.statusCode).toBe(201);
  expect(res.json().data.rfqNumber).toMatch(/^RFQ-\d{4}-\d{6}$/);
  expect(res.json().data.status).toBe("DRAFT");
});

// 10. RFQ submission
it("cannot submit empty RFQ", async () => {
  const rfqRes = await app.inject({
    method: "POST",
    url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${token}` },
    payload: {},
  });
  const rfqId = rfqRes.json().data.id;

  const res = await app.inject({
    method: "POST",
    url: `/api/v1/rfqs/${rfqId}/submit`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(422);
});

it("submits RFQ with items", async () => {
  const rfqRes = await app.inject({
    method: "POST",
    url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${token}` },
    payload: {},
  });
  const rfqId = rfqRes.json().data.id;

  await app.inject({
    method: "POST",
    url: `/api/v1/rfqs/${rfqId}/items`,
    headers: { authorization: `Bearer ${token}` },
    payload: { mpn: "STM32F103C8T6", quantity: 100 },
  });

  const res = await app.inject({
    method: "POST",
    url: `/api/v1/rfqs/${rfqId}/submit`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().data.status).toBe("SUBMITTED");
});

// 11. Invalid RFQ data rejected
it("rejects invalid priority value", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/rfqs",
    headers: { authorization: `Bearer ${token}` },
    payload: { priority: "URGENT" },
  });
  expect(res.statusCode).toBe(400);
});

// 15. RFQ number uniqueness
it("creates unique RFQ numbers for concurrent requests", async () => {
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      app.inject({
        method: "POST",
        url: "/api/v1/rfqs",
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      }),
    ),
  );
  const numbers = results.map((r) => r.json().data.rfqNumber);
  const unique = new Set(numbers);
  expect(unique.size).toBe(5);
});