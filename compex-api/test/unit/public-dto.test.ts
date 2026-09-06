import { describe, expect, it } from "vitest";
import { filterPublicSpecifications, isPublicSafeSpecKey, toPublicManufacturer, toPublicProduct } from "../../src/modules/catalog/public-dto.js";

const baseProduct = {
  id: "prod-1",
  mpn: "STM32F103C8T6",
  normalizedMpn: "STM32F103C8T6",
  name: "STM32F103C8T6 MCU",
  description: "32-bit MCU",
  manufacturerId: "man-1",
  categoryId: null,
  specifications: { Resistance: "10k", "Package / Case": "LQFP48", isCanonical: "true", productTraceability: "batch-9", supplierSku: "ABC-1", price: "1.23" },
  packageType: "LQFP48",
  mountingType: "SMD",
  lifecycleStatus: "Active",
  datasheetUrl: "https://st.com/stm32.pdf",
  images: ["https://img.example.com/stm32.jpg"],
  isActive: true,
  source: "MOUSER",
  sourceUrl: "https://mouser.com/private/detail",
  sourceProductId: "MOUSER-SKU-1",
  lastImportedAt: new Date("2026-01-01"),
  dataHash: "abc123",
  importStatus: "IMPORTED",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
} as const;

const baseManufacturer = {
  id: "man-1",
  name: "STMicroelectronics",
  slug: "stmicroelectronics",
  logoUrl: "https://img.example.com/st-logo.png",
  website: "https://st.com",
  description: "Semiconductor manufacturer",
  country: "Switzerland",
  source: "MOUSER",
  sourceUrl: "https://mouser.com/private/manufacturer",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
} as const;

describe("isPublicSafeSpecKey", () => {
  it("blocks internal/system spec key names", () => {
    expect(isPublicSafeSpecKey("isCanonical")).toBe(false);
    expect(isPublicSafeSpecKey("productTraceability")).toBe(false);
    expect(isPublicSafeSpecKey("supplierSku")).toBe(false);
    expect(isPublicSafeSpecKey("price")).toBe(false);
    expect(isPublicSafeSpecKey("cost")).toBe(false);
    expect(isPublicSafeSpecKey("stock")).toBe(false);
    expect(isPublicSafeSpecKey("moq")).toBe(false);
    expect(isPublicSafeSpecKey("leadTime")).toBe(false);
    expect(isPublicSafeSpecKey("vendorNotes")).toBe(false);
    expect(isPublicSafeSpecKey("internalNotes")).toBe(false);
  });

  it("allows legitimate customer-facing spec names, including ones that share a word with a blocked term", () => {
    expect(isPublicSafeSpecKey("Resistance")).toBe(true);
    expect(isPublicSafeSpecKey("Voltage - Rated")).toBe(true);
    expect(isPublicSafeSpecKey("Package / Case")).toBe(true);
    expect(isPublicSafeSpecKey("Tolerance")).toBe(true);
    expect(isPublicSafeSpecKey("Operating Temperature")).toBe(true);
    expect(isPublicSafeSpecKey("RoHS Status")).toBe(true);
    expect(isPublicSafeSpecKey("Lead Free Status")).toBe(true);
  });
});

describe("filterPublicSpecifications", () => {
  it("strips internal keys and keeps legitimate ones", () => {
    const result = filterPublicSpecifications(baseProduct.specifications);
    expect(result).toEqual({ Resistance: "10k", "Package / Case": "LQFP48" });
  });

  it("handles null/undefined input safely", () => {
    expect(filterPublicSpecifications(null)).toEqual({});
    expect(filterPublicSpecifications(undefined)).toEqual({});
  });
});

describe("toPublicProduct", () => {
  it("never includes source, sourceUrl, sourceProductId, importStatus, dataHash, normalizedMpn, isActive, createdAt, or updatedAt", () => {
    const dto = toPublicProduct(baseProduct as never);
    const json = JSON.stringify(dto);
    expect(json).not.toMatch(/MOUSER-SKU-1|mouser\.com|abc123|IMPORTED|isCanonical|productTraceability|supplierSku/i);
    expect(dto).not.toHaveProperty("source");
    expect(dto).not.toHaveProperty("sourceUrl");
    expect(dto).not.toHaveProperty("sourceProductId");
    expect(dto).not.toHaveProperty("importStatus");
    expect(dto).not.toHaveProperty("dataHash");
    expect(dto).not.toHaveProperty("normalizedMpn");
    expect(dto).not.toHaveProperty("isActive");
    expect(dto).not.toHaveProperty("createdAt");
    expect(dto).not.toHaveProperty("updatedAt");
  });

  it("keeps legitimate product facts", () => {
    const dto = toPublicProduct(baseProduct as never);
    expect(dto.mpn).toBe("STM32F103C8T6");
    expect(dto.specifications).toEqual({ Resistance: "10k", "Package / Case": "LQFP48" });
  });

  it("maps a nested manufacturer/category through their own public mappers", () => {
    const dto = toPublicProduct({ ...baseProduct, manufacturer: baseManufacturer, category: null } as never);
    expect(dto.manufacturer).toEqual({
      id: "man-1", name: "STMicroelectronics", slug: "stmicroelectronics",
      logoUrl: "https://img.example.com/st-logo.png", website: "https://st.com",
      description: "Semiconductor manufacturer", country: "Switzerland",
    });
    expect(JSON.stringify(dto.manufacturer)).not.toMatch(/mouser/i);
  });
});

describe("toPublicManufacturer", () => {
  it("never includes source or sourceUrl", () => {
    const dto = toPublicManufacturer(baseManufacturer as never);
    expect(dto).not.toHaveProperty("source");
    expect(dto).not.toHaveProperty("sourceUrl");
    expect(JSON.stringify(dto)).not.toMatch(/mouser/i);
  });
});
