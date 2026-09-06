import { describe, it, expect, beforeEach } from "vitest";
import { cleanDb } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";
import { normalizeItem } from "../../src/modules/catalog-import/normalizer.js";
import { upsertProduct } from "../../src/modules/catalog-import/upsert.js";
import { RawCatalogItemSchema } from "../../src/modules/catalog-import/validator.js";

// Exercises upsert.ts's manufacturer-aware findExistingProduct() directly
// against the real test database -- this is the mechanism task item 4
// (manufacturer-aware canonical matching) actually depends on, independent
// of any one provider's HTTP layer.
async function importRow(row: { mpn: string; manufacturer?: string; internalOffers?: unknown[] }, source: string) {
  const parsed = RawCatalogItemSchema.parse(row);
  const normalized = await normalizeItem(parsed, source);
  const result = await upsertProduct(normalized, source);
  const product = await prisma.product.findFirst({
    where: { normalizedMpn: normalized.mpn.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""), manufacturerId: normalized.manufacturerId ?? null },
  });
  return { outcome: result.outcome, product };
}

beforeEach(cleanDb);

describe("manufacturer-aware product dedup (upsert.ts)", () => {
  it("merges the same MPN + same manufacturer from three different sources into ONE canonical product", async () => {
    const a = await importRow({ mpn: "STM32F103C8T6", manufacturer: "STMicroelectronics" }, "MOUSER");
    const b = await importRow({ mpn: "STM32F103C8T6", manufacturer: "STMicroelectronics" }, "ELEMENT14");
    const c = await importRow({ mpn: "STM32F103C8T6", manufacturer: "STMicroelectronics" }, "DIGIKEY");

    expect(a.outcome).toBe("created"); // first source: new Product + new ProductSource
    expect(b.outcome).toBe("updated"); // existing Product row (canonical fields untouched), new ProductSource
    expect(c.outcome).toBe("updated");
    expect(b.product!.id).toBe(a.product!.id);
    expect(c.product!.id).toBe(a.product!.id);

    const sources = await prisma.productSource.findMany({ where: { productId: a.product!.id } });
    expect(sources.map((s) => s.source).sort()).toEqual(["DIGIKEY", "ELEMENT14", "MOUSER"]);

    const allProducts = await prisma.product.findMany({ where: { normalizedMpn: "STM32F103C8T6" } });
    expect(allProducts).toHaveLength(1);
  });

  it("does NOT merge the same MPN string from two different real manufacturers", async () => {
    const acme = await importRow({ mpn: "X1000", manufacturer: "Acme Co" }, "MOUSER");
    const zenith = await importRow({ mpn: "X1000", manufacturer: "Zenith Corp" }, "MOUSER");

    expect(acme.product!.id).not.toBe(zenith.product!.id);
    const allProducts = await prisma.product.findMany({ where: { normalizedMpn: "X1000" } });
    expect(allProducts).toHaveLength(2);
    expect(allProducts.map((p) => p.manufacturerId).sort()).not.toEqual([null, null]);
  });

  it("keeps re-importing a sparse source (no manufacturer) idempotent instead of duplicating", async () => {
    const first = await importRow({ mpn: "Y2000" }, "MANUAL_CSV");
    const second = await importRow({ mpn: "Y2000" }, "MANUAL_CSV");

    expect(first.product!.id).toBe(second.product!.id);
    const allProducts = await prisma.product.findMany({ where: { normalizedMpn: "Y2000" } });
    expect(allProducts).toHaveLength(1);
  });

  it("does not let a second source overwrite the canonical product's own source-specific data", async () => {
    await importRow({ mpn: "Z3000", manufacturer: "Acme Co" }, "MOUSER");
    const canonicalBefore = await prisma.product.findFirst({ where: { normalizedMpn: "Z3000" } });
    expect(canonicalBefore!.source).toBe("MOUSER");

    await importRow({ mpn: "Z3000", manufacturer: "Acme Co" }, "ELEMENT14");
    const canonicalAfter = await prisma.product.findFirst({ where: { normalizedMpn: "Z3000" } });
    // Canonical display fields still attributed to the first (MOUSER) source.
    expect(canonicalAfter!.source).toBe("MOUSER");

    const element14Source = await prisma.productSource.findUnique({
      where: { productId_source: { productId: canonicalAfter!.id, source: "ELEMENT14" } },
    });
    expect(element14Source).not.toBeNull();
  });
});
