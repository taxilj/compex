import { beforeEach, describe, expect, it, vi } from "vitest";

const nexarGraphQLMock = vi.fn();
const cacheGetMock = vi.fn();
const cacheSetMock = vi.fn();

vi.mock("../../src/modules/catalog-import/fetchers/nexar-client.js", () => ({
  nexarGraphQL: (...args: unknown[]) => nexarGraphQLMock(...args),
}));
vi.mock("../../src/lib/cache.js", () => ({
  cacheGet: (...args: unknown[]) => cacheGetMock(...args),
  cacheSet: (...args: unknown[]) => cacheSetMock(...args),
}));

const { lookupPublicProduct, mapNexarPublicProduct, normalizePublicMpn } = await import("../../src/modules/catalog/public-product-lookup.js");

const part = {
  mpn: "STM32F103C8T6",
  manufacturer: { name: "STMicroelectronics" },
  category: { name: "Embedded - Microcontrollers" },
  shortDescription: "32-bit ARM Cortex-M3 microcontroller",
  images: [{ url: "https://images.example.com/stm32.jpg" }],
  bestDatasheet: { url: "https://www.st.com/stm32.pdf" },
  specs: [
    { attribute: { name: "Package / Case", shortname: "package" }, displayValue: "48-LQFP" },
    { attribute: { name: "Lifecycle Status", shortname: "lifecycle" }, displayValue: "Production" },
    { attribute: { name: "RoHS Status", shortname: "rohsstatus", group: "Compliance" }, displayValue: "RoHS3 Compliant" },
  ],
  // This deliberately represents unexpected raw data. The public mapper must
  // still never make it part of the response.
  sellers: [{ company: { name: "Supplier" }, offers: [{ prices: [{ price: 1.2 }], inventoryLevel: 10, moq: 1, clickUrl: "https://supplier.example/private" }] }],
};

beforeEach(() => {
  nexarGraphQLMock.mockReset();
  cacheGetMock.mockReset();
  cacheSetMock.mockReset();
  cacheGetMock.mockResolvedValue(null);
  cacheSetMock.mockResolvedValue(undefined);
});

describe("public Nexar MPN lookup", () => {
  it("normalizes outer whitespace and case, and rejects blank, invalid, and excessively long values", () => {
    expect(normalizePublicMpn("  stm32f103c8t6  ")).toBe("STM32F103C8T6");
    expect(() => normalizePublicMpn("   ")).toThrow(/required/i);
    expect(() => normalizePublicMpn("STM32<script>")).toThrow(/invalid/i);
    expect(() => normalizePublicMpn("A".repeat(101))).toThrow(/100/);
  });

  it("maps an exact Nexar result into the public product shape and uses a short-lived cache", async () => {
    nexarGraphQLMock.mockResolvedValue({ supSearchMpn: { results: [{ part }] } });

    const result = await lookupPublicProduct(" stm32f103c8t6 ");

    expect(result).toEqual({
      mpn: "STM32F103C8T6",
      manufacturer: "STMicroelectronics",
      productName: "32-bit ARM Cortex-M3 microcontroller",
      description: "32-bit ARM Cortex-M3 microcontroller",
      category: "Embedded - Microcontrollers",
      imageUrl: "https://images.example.com/stm32.jpg",
      datasheetUrl: "https://www.st.com/stm32.pdf",
      lifecycleStatus: "Production",
      compliance: ["RoHS3 Compliant"],
      specifications: [
        { name: "Package / Case", value: "48-LQFP" },
        { name: "Lifecycle Status", value: "Production" },
        { name: "RoHS Status", value: "RoHS3 Compliant" },
      ],
    });
    expect(nexarGraphQLMock.mock.calls[0][0]).not.toMatch(/sellers|offers|prices|inventoryLevel|moq|clickUrl/i);
    expect(cacheSetMock.mock.calls[0][0]).toBe("public-nexar-mpn-lookup");
    expect(cacheSetMock.mock.calls[0][1]).toBe("STM32F103C8T6");
    expect(cacheSetMock.mock.calls[0][3]).toBeLessThanOrEqual(300);
  });

  it("returns null for zero hits or near matches, never a guessed product", async () => {
    nexarGraphQLMock.mockResolvedValue({ supSearchMpn: { results: [{ part: { mpn: "STM32F103C8T6-TR" } }] } });
    await expect(lookupPublicProduct("STM32F103C8T6")).resolves.toBeNull();
  });

  it("returns a cached factual result without calling Nexar", async () => {
    cacheGetMock.mockResolvedValue({ value: { mpn: "CACHED1", manufacturer: "Maker", productName: "Cached", specifications: [] } });
    await expect(lookupPublicProduct("cached1")).resolves.toMatchObject({ mpn: "CACHED1" });
    expect(nexarGraphQLMock).not.toHaveBeenCalled();
  });

  it("never leaks supplier, pricing, stock, MOQ, lead-time, offer URLs, or secrets from unexpected raw data", () => {
    const mapped = mapNexarPublicProduct(part);
    const response = JSON.stringify(mapped);
    expect(response).not.toMatch(/Supplier|prices|price|inventoryLevel|moq|factoryLeadDays|supplier\.example|client.secret|client_id/i);
  });
});
