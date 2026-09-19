import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, cleanDb, createAdminAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

let app: FastifyInstance;
let auth: { authorization: string };
const mfr: Record<string, string> = {};
let categoryId: string;

async function post(url: string, payload: object) {
  const res = await app.inject({ method: "POST", url, headers: auth, payload });
  expect(res.statusCode).toBe(201);
  return res.json().data;
}

beforeAll(async () => {
  app = await createTestApp();
  await cleanDb();
  const { accessToken } = await createAdminAndLogin(app, "catalog-list-admin@test.com");
  auth = { authorization: `Bearer ${accessToken}` };
  mfr.a = (await post("/api/v1/admin/manufacturers", { name: "Alpha Semi", slug: "alpha-semi" })).id;
  mfr.b = (await post("/api/v1/admin/manufacturers", { name: "Beta Micro", slug: "beta-micro" })).id;
  categoryId = (await post("/api/v1/admin/categories", { name: "Regulators" })).id;
  for (let i = 1; i <= 5; i++) {
    await post("/api/v1/admin/products", {
      mpn: `PART-${String(i).padStart(2, "0")}`,
      name: `Part ${i}`,
      manufacturerId: i <= 3 ? mfr.a : mfr.b,
      ...(i <= 2 ? { categoryId } : {}),
      specifications: { Voltage: "5V" },
    });
  }
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const list = async (qs: string) => {
  const res = await app.inject({ method: "GET", url: `/api/v1/products?${qs}` });
  expect(res.statusCode).toBe(200);
  return res;
};

describe("public product list", () => {
  it("paginates server-side with stable order and total metadata", async () => {
    const p1 = (await list("limit=2&page=1")).json();
    const p2 = (await list("limit=2&page=2")).json();
    const p3 = (await list("limit=2&page=3")).json();
    expect(p1.meta).toMatchObject({ total: 5, page: 1, limit: 2 });
    expect(p1.data.map((p: { mpn: string }) => p.mpn)).toEqual(["PART-01", "PART-02"]);
    expect(p2.data.map((p: { mpn: string }) => p.mpn)).toEqual(["PART-03", "PART-04"]);
    expect(p3.data.map((p: { mpn: string }) => p.mpn)).toEqual(["PART-05"]);
  });

  it("filters by manufacturer and by category", async () => {
    const byMfr = (await list(`manufacturerId=${mfr.b}`)).json();
    expect(byMfr.meta.total).toBe(2);
    const byCat = (await list(`categoryId=${categoryId}`)).json();
    expect(byCat.data.map((p: { mpn: string }) => p.mpn)).toEqual(["PART-01", "PART-02"]);
  });

  it("returns lean rows: no specifications payload, no internal fields", async () => {
    const [row] = (await list("limit=1")).json().data;
    expect(row.specifications).toEqual({});
    expect(row).not.toHaveProperty("normalizedMpn");
    expect(row).not.toHaveProperty("internalOffers");
  });

  it("serves repeated queries with public cache headers and identical bodies", async () => {
    const first = await list("q=part&limit=3");
    const second = await list("q=part&limit=3");
    expect(second.headers["cache-control"]).toContain("stale-while-revalidate");
    expect(second.body).toBe(first.body);
  });

  it("invalidates cached lists after an admin catalogue write", async () => {
    const before = (await list("limit=10")).json().meta.total;
    await post("/api/v1/admin/products", { mpn: "PART-99", name: "Late add", manufacturerId: mfr.a });
    const after = (await list("limit=10")).json().meta.total;
    expect(after).toBe(before + 1);
  });

  it("rejects an over-large page size and bad ids instead of returning everything", async () => {
    expect((await app.inject({ method: "GET", url: "/api/v1/products?limit=5000" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/v1/products?manufacturerId=nope" })).statusCode).toBe(400);
  });

  it("serves the category tree with Cache-Control and only UI fields", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/categories" });
    expect(res.headers["cache-control"]).toContain("s-maxage");
    const node = res.json().data[0];
    expect(Object.keys(node).sort()).toEqual(["_count", "children", "description", "id", "name", "parentId"]);
  });
});
