import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, cleanDb, registerAndLogin, createAdminAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";
import { normalizeItem } from "../../src/modules/catalog-import/normalizer.js";
import { upsertProduct } from "../../src/modules/catalog-import/upsert.js";
import { RawCatalogItemSchema } from "../../src/modules/catalog-import/validator.js";

let app: FastifyInstance;
let adminToken: string;
let customerToken: string;

beforeAll(async () => {
  app = await createTestApp();
  await cleanDb();
  ({ accessToken: adminToken } = await createAdminAndLogin(app, "catalog-admin@test.com"));
  ({ accessToken: customerToken } = await registerAndLogin(app, "catalog-customer@test.com", "Catalog"));
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("admin category CRUD", () => {
  it("creates a top-level category and a subcategory under it", async () => {
    const parentRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Microcontrollers" },
    });
    expect(parentRes.statusCode).toBe(201);
    const parentId = parentRes.json().data.id;

    const childRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "32-bit MCUs", parentId },
    });
    expect(childRes.statusCode).toBe(201);
    expect(childRes.json().data.parentId).toBe(parentId);
  });

  it("rejects a category becoming its own ancestor", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Sensors" },
    });
    const id = res.json().data.id;

    const cycle = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/categories/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { parentId: id },
    });
    expect(cycle.statusCode).toBe(400);
  });

  it("rejects category management from a customer", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("admin product CRUD", () => {
  let stmManufacturerId: string;

  it("creates a product with manufacturer and category relations", async () => {
    const mfrRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/manufacturers",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "STMicroelectronics", slug: "stmicroelectronics" },
    });
    const manufacturerId = mfrRes.json().data.id;
    stmManufacturerId = manufacturerId;

    const catRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Power Management" },
    });
    const categoryId = catRes.json().data.id;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { mpn: "STM32F103C8T6", name: "ARM Cortex-M3 MCU", manufacturerId, categoryId, packageType: "LQFP48" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.manufacturer.id).toBe(manufacturerId);
    expect(res.json().data.category.id).toBe(categoryId);
  });

  it("rejects a duplicate MPN for the SAME manufacturer with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: { authorization: `Bearer ${adminToken}` },
      // Manufacturer-aware dedup (see upsert.ts): a true duplicate must name
      // the same manufacturer as the existing STM32F103C8T6 row above.
      payload: { mpn: "STM32F103C8T6", manufacturerId: stmManufacturerId },
    });
    expect(res.statusCode).toBe(409);
  });

  it("allows the same MPN text for a DIFFERENT manufacturer (not treated as a duplicate)", async () => {
    const mfrRes = await app.inject({
      method: "POST",
      url: "/api/v1/admin/manufacturers",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Generic Semiconductor Co", slug: "generic-semiconductor-co" },
    });
    const otherManufacturerId = mfrRes.json().data.id;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { mpn: "DUPLICATE-MPN-DIFFERENT-MFR", manufacturerId: otherManufacturerId },
    });
    expect(res.statusCode).toBe(201);

    const clash = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { mpn: "DUPLICATE-MPN-DIFFERENT-MFR", manufacturerId: stmManufacturerId },
    });
    expect(clash.statusCode).toBe(201);
    expect(clash.json().data.id).not.toBe(res.json().data.id);
  });

  it("rejects product management from a customer", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { mpn: "SHOULD-NOT-CREATE" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("public product search", () => {
  it("ranks an exact MPN match first, ahead of substring matches", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { mpn: "STM32F103C8T6X", name: "Similar part" },
    });

    const res = await app.inject({ method: "GET", url: "/api/v1/products?q=STM32F103C8T6" });
    expect(res.statusCode).toBe(200);
    const data = res.json().data as Array<{ mpn: string }>;
    expect(data[0].mpn).toBe("STM32F103C8T6");
  });

  it("returns a single product by MPN", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/products/STM32F103C8T6" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.mpn).toBe("STM32F103C8T6");
  });

  it("404s for an unknown MPN", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/products/NO-SUCH-PART" });
    expect(res.statusCode).toBe(404);
  });

  it("requires manufacturer selection when an MPN belongs to multiple manufacturers", async () => {
    const ambiguous = await app.inject({ method: "GET", url: "/api/v1/products/DUPLICATE-MPN-DIFFERENT-MFR" });
    expect(ambiguous.statusCode).toBe(409);

    const selectedProduct = await prisma.product.findFirstOrThrow({
      where: { mpn: "DUPLICATE-MPN-DIFFERENT-MFR", manufacturer: { name: "STMicroelectronics" } },
    });

    const selected = await app.inject({
      method: "GET",
      url: `/api/v1/products/DUPLICATE-MPN-DIFFERENT-MFR?manufacturerId=${selectedProduct.manufacturerId}`,
    });
    expect(selected.statusCode).toBe(200);
    expect(selected.json().data.manufacturer.id).toBe(selectedProduct.manufacturerId);
  });

  // Nexar task Phase 5 / Phase 18 item 10: pricing/offer data collected for
  // internal sourcing (see ProductSource.internalOffers) must never reach
  // the public product API, no matter which source imported it.
  it("never includes supplier pricing/offer data in the public product response, even for a product imported with Nexar internal offers", async () => {
    const parsed = RawCatalogItemSchema.parse({ mpn: "NEXAR-PRICED-PART", manufacturer: "Acme Co" });
    const normalized = await normalizeItem(parsed, "NEXAR");
    await upsertProduct(
      {
        ...normalized,
        internalOffers: [{ seller: "Digi-Key", price: 12.34, currency: "USD", moq: 5, inventoryLevel: 900, factoryLeadDays: 30, sku: "SECRET-SKU" }],
      },
      "NEXAR",
    );

    const res = await app.inject({ method: "GET", url: "/api/v1/products/NEXAR-PRICED-PART" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).not.toHaveProperty("sources");
    expect(body.data).not.toHaveProperty("internalOffers");
    const raw = res.body;
    expect(raw).not.toMatch(/12\.34|SECRET-SKU|inventoryLevel|factoryLeadDays/i);
  });
});

describe("RFQ item + Product link (Phase 6)", () => {
  it("adds a manual RFQ item without a product link (backward compatible)", async () => {
    const rfqRes = await app.inject({
      method: "POST",
      url: "/api/v1/rfqs",
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {},
    });
    const rfqId = rfqRes.json().data.id;

    const itemRes = await app.inject({
      method: "POST",
      url: `/api/v1/rfqs/${rfqId}/items`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { mpn: "MANUAL-ENTRY-PART", manufacturer: "Acme", quantity: 5 },
    });
    expect(itemRes.statusCode).toBe(201);
    expect(itemRes.json().data.productId).toBeNull();
    expect(itemRes.json().data.mpn).toBe("MANUAL-ENTRY-PART");
  });

  it("links an RFQ item to a catalog Product and copies its mpn/manufacturer/description", async () => {
    const productRes = await app.inject({ method: "GET", url: "/api/v1/products/STM32F103C8T6" });
    const product = productRes.json().data;

    const rfqRes = await app.inject({
      method: "POST",
      url: "/api/v1/rfqs",
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {},
    });
    const rfqId = rfqRes.json().data.id;

    const itemRes = await app.inject({
      method: "POST",
      url: `/api/v1/rfqs/${rfqId}/items`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { mpn: product.mpn, quantity: 10, productId: product.id },
    });
    expect(itemRes.statusCode).toBe(201);
    expect(itemRes.json().data.productId).toBe(product.id);
    expect(itemRes.json().data.mpn).toBe(product.mpn);
    expect(itemRes.json().data.manufacturer).toBe(product.manufacturer.name);
  });

  it("404s when productId references a non-existent product", async () => {
    const rfqRes = await app.inject({
      method: "POST",
      url: "/api/v1/rfqs",
      headers: { authorization: `Bearer ${customerToken}` },
      payload: {},
    });
    const rfqId = rfqRes.json().data.id;

    const itemRes = await app.inject({
      method: "POST",
      url: `/api/v1/rfqs/${rfqId}/items`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { mpn: "IGNORED", quantity: 1, productId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(itemRes.statusCode).toBe(404);
  });
});

describe("catalog CSV import (idempotency + duplicate prevention)", () => {
  function csvBody(rows: string): { buffer: Buffer; boundary: string } {
    const boundary = "----catalogImportTestBoundary";
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="catalog.csv"\r\n` +
      `Content-Type: text/csv\r\n\r\n` +
      `${rows}\r\n` +
      `--${boundary}--\r\n`;
    return { buffer: Buffer.from(body), boundary };
  }

  it("imports new rows, then a re-run with unchanged data updates nothing (idempotent)", async () => {
    const rows = "mpn,manufacturer,name\nLM358,Texas Instruments,Dual Op-Amp\n";
    const { buffer, boundary } = csvBody(rows);

    const first = await app.inject({
      method: "POST",
      url: "/api/v1/admin/catalog-import/csv",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: buffer,
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().data.itemsCreated).toBe(1);
    expect(first.json().data.status).toBe("COMPLETED");

    const { buffer: buffer2, boundary: boundary2 } = csvBody(rows);
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/admin/catalog-import/csv",
      headers: { authorization: `Bearer ${adminToken}`, "content-type": `multipart/form-data; boundary=${boundary2}` },
      payload: buffer2,
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().data.itemsCreated).toBe(0);
    expect(second.json().data.itemsUpdated).toBe(0);

    const products = await prisma.product.findMany({ where: { mpn: "LM358" } });
    expect(products).toHaveLength(1);
  });

  it("rejects catalog import from a customer", async () => {
    const { buffer, boundary } = csvBody("mpn\nX1\n");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/admin/catalog-import/csv",
      headers: { authorization: `Bearer ${customerToken}`, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: buffer,
    });
    expect(res.statusCode).toBe(403);
  });
});
