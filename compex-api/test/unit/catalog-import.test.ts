import { describe, it, expect } from "vitest";
import { RawCatalogItemSchema } from "../../src/modules/catalog-import/validator.js";
import { computeDataHash } from "../../src/modules/catalog-import/deduplicator.js";
import { normalizeMpn, type NormalizedProduct } from "../../src/modules/catalog-import/normalizer.js";

describe("RawCatalogItemSchema (validator)", () => {
  it("accepts a row with only an mpn", () => {
    const result = RawCatalogItemSchema.safeParse({ mpn: "STM32F103C8T6" });
    expect(result.success).toBe(true);
  });

  it("rejects a row missing mpn", () => {
    const result = RawCatalogItemSchema.safeParse({ manufacturer: "STMicroelectronics" });
    expect(result.success).toBe(false);
  });

  it("rejects a row with a blank mpn", () => {
    const result = RawCatalogItemSchema.safeParse({ mpn: "   " });
    expect(result.success).toBe(false);
  });

  it("trims whitespace from string fields", () => {
    const result = RawCatalogItemSchema.safeParse({ mpn: "  STM32F103C8T6  ", manufacturer: "  ST  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mpn).toBe("STM32F103C8T6");
      expect(result.data.manufacturer).toBe("ST");
    }
  });

  it("rejects an invalid datasheet URL", () => {
    const result = RawCatalogItemSchema.safeParse({ mpn: "X1", datasheetUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("treats an empty datasheet URL as absent rather than invalid", () => {
    const result = RawCatalogItemSchema.safeParse({ mpn: "X1", datasheetUrl: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.datasheetUrl).toBeUndefined();
  });
});

describe("computeDataHash (deduplicator)", () => {
  const base: NormalizedProduct = {
    mpn: "STM32F103C8T6",
    name: "ARM Cortex-M3 MCU",
    manufacturerId: "mfr-1",
    categoryId: "cat-1",
  };

  it("produces the same hash for identical normalized data (idempotent re-import)", () => {
    expect(computeDataHash(base)).toBe(computeDataHash({ ...base }));
  });

  it("produces a different hash when a meaningful field changes", () => {
    expect(computeDataHash(base)).not.toBe(computeDataHash({ ...base, name: "Different name" }));
  });

  it("is insensitive to the mpn field itself (mpn is the upsert key, not part of the hash)", () => {
    expect(computeDataHash(base)).toBe(computeDataHash({ ...base, mpn: "OTHER-MPN" }));
  });

  it("treats undefined and explicit-null-equivalent optional fields consistently", () => {
    const a: NormalizedProduct = { mpn: "X1" };
    const b: NormalizedProduct = { mpn: "X2" };
    expect(computeDataHash(a)).toBe(computeDataHash(b));
  });
});

describe("normalizeMpn", () => {
  it("matches common separator and case variations without changing the displayed MPN", () => {
    expect(normalizeMpn(" stm-32_f103 c8t6 ")).toBe("STM32F103C8T6");
  });
});
