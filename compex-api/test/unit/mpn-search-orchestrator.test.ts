import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mouserFetch: vi.fn(), digikeyFetch: vi.fn(), element14Fetch: vi.fn(), cacheGet: vi.fn(), cacheSet: vi.fn(),
}));
vi.mock("../../src/modules/catalog-import/fetchers/mouser-fetcher.js", () => ({
  createMouserFetcher: (mpn: string) => ({ source: "MOUSER", fetch: () => mocks.mouserFetch(mpn) }),
}));
vi.mock("../../src/modules/catalog-import/fetchers/digikey-fetcher.js", () => ({
  createDigiKeyFetcher: (mpn: string) => ({ source: "DIGIKEY", fetch: () => mocks.digikeyFetch(mpn) }),
}));
vi.mock("../../src/modules/catalog-import/fetchers/element14-fetcher.js", () => ({
  createElement14Fetcher: (mpn: string) => ({ source: "ELEMENT14", fetch: () => mocks.element14Fetch(mpn) }),
}));
vi.mock("../../src/lib/cache.js", () => ({
  cacheGet: (...args: unknown[]) => mocks.cacheGet(...args),
  cacheSet: (...args: unknown[]) => mocks.cacheSet(...args),
}));

const { searchMpnAcrossProviders, mergeRawCatalogItems, mapRawItemToPublicProduct, normalizePublicMpn } =
  await import("../../src/modules/catalog/mpn-search-orchestrator.js");

const item = {
  mpn: "STM32F103C8T6", manufacturer: "STMicroelectronics", description: "32-bit MCU",
  datasheetUrl: "https://st.com/stm32.pdf", images: ["https://img.example.com/stm32.jpg"],
  specifications: { Package: "LQFP48", rohsStatus: "RoHS Compliant" },
};
const noMatch = () => Promise.resolve({ items: [] });
const rateLimited = Object.assign(new Error("Too many requests"), { code: "RATE_LIMITED" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cacheGet.mockResolvedValue(null);
  mocks.cacheSet.mockResolvedValue(undefined);
});

describe("three-provider MPN orchestration", () => {
  it("returns Mouser's match while the other providers complete independently", async () => {
    mocks.mouserFetch.mockResolvedValue({ items: [item] });
    mocks.digikeyFetch.mockImplementation(noMatch);
    mocks.element14Fetch.mockImplementation(noMatch);
    const result = await searchMpnAcrossProviders("STM32F103C8T6");
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    expect(result.sources).toEqual([
      { provider: "MOUSER", status: "FOUND" },
      { provider: "DIGIKEY", status: "NO_MATCH" },
      { provider: "ELEMENT14", status: "NO_MATCH" },
    ]);
  });

  it("returns DigiKey's match when Mouser errors", async () => {
    mocks.mouserFetch.mockRejectedValue(new Error("Mouser unavailable"));
    mocks.digikeyFetch.mockResolvedValue({ items: [item] });
    mocks.element14Fetch.mockImplementation(noMatch);
    const result = await searchMpnAcrossProviders("STM32F103C8T6");
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    expect(result.sources).toContainEqual({ provider: "MOUSER", status: "ERROR" });
    expect(result.sources).toContainEqual({ provider: "DIGIKEY", status: "FOUND" });
  });

  it("returns Element14's match when Mouser errors and DigiKey has no match", async () => {
    mocks.mouserFetch.mockRejectedValue(new Error("Mouser unavailable"));
    mocks.digikeyFetch.mockImplementation(noMatch);
    mocks.element14Fetch.mockResolvedValue({ items: [item] });
    const result = await searchMpnAcrossProviders("STM32F103C8T6");
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    expect(result.sources).toContainEqual({ provider: "ELEMENT14", status: "FOUND" });
  });

  it("preserves three independent errors", async () => {
    mocks.mouserFetch.mockRejectedValue(new Error("Mouser unavailable"));
    mocks.digikeyFetch.mockRejectedValue(new Error("DigiKey unavailable"));
    mocks.element14Fetch.mockRejectedValue(new Error("Element14 unavailable"));
    const result = await searchMpnAcrossProviders("STM32F103C8T6");
    expect(result.product).toBeNull();
    expect(result.sources).toEqual([
      { provider: "MOUSER", status: "ERROR" },
      { provider: "DIGIKEY", status: "ERROR" },
      { provider: "ELEMENT14", status: "ERROR" },
    ]);
  });

  it("does not let a Mouser timeout stop DigiKey and Element14", async () => {
    mocks.mouserFetch.mockImplementation(() => new Promise(() => undefined));
    mocks.digikeyFetch.mockImplementation(noMatch);
    mocks.element14Fetch.mockResolvedValue({ items: [item] });
    const result = await searchMpnAcrossProviders("STM32F103C8T6");
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    expect(result.sources).toContainEqual({ provider: "MOUSER", status: "TIMEOUT" });
    expect(mocks.digikeyFetch).toHaveBeenCalledTimes(1);
    expect(mocks.element14Fetch).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("does not let a Mouser rate limit stop DigiKey and Element14", async () => {
    mocks.mouserFetch.mockRejectedValue(rateLimited);
    mocks.digikeyFetch.mockImplementation(noMatch);
    mocks.element14Fetch.mockResolvedValue({ items: [item] });
    const result = await searchMpnAcrossProviders("STM32F103C8T6");
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    expect(result.sources).toContainEqual({ provider: "MOUSER", status: "RATE_LIMITED" });
    expect(mocks.digikeyFetch).toHaveBeenCalledTimes(1);
    expect(mocks.element14Fetch).toHaveBeenCalledTimes(1);
  });

  it("returns a clean no-result after exactly three NO_MATCH states", async () => {
    mocks.mouserFetch.mockImplementation(noMatch);
    mocks.digikeyFetch.mockImplementation(noMatch);
    mocks.element14Fetch.mockImplementation(noMatch);
    const result = await searchMpnAcrossProviders("UNKNOWN-PART");
    expect(result.product).toBeNull();
    expect(result.sources).toEqual([
      { provider: "MOUSER", status: "NO_MATCH" },
      { provider: "DIGIKEY", status: "NO_MATCH" },
      { provider: "ELEMENT14", status: "NO_MATCH" },
    ]);
    expect(mocks.cacheSet.mock.calls.find((call) => call[0] === "public-mpn-search-product")?.[2]).toMatchObject({ product: null });
  });

  it("runs exactly the three configured provider fetchers and no hidden fallback", async () => {
    mocks.mouserFetch.mockImplementation(noMatch);
    mocks.digikeyFetch.mockImplementation(noMatch);
    mocks.element14Fetch.mockImplementation(noMatch);
    await searchMpnAcrossProviders("UNKNOWN-PART");
    expect(mocks.mouserFetch).toHaveBeenCalledTimes(1);
    expect(mocks.digikeyFetch).toHaveBeenCalledTimes(1);
    expect(mocks.element14Fetch).toHaveBeenCalledTimes(1);
  });
});

describe("public result safeguards", () => {
  it("normalizes valid MPNs and rejects invalid input", () => {
    expect(normalizePublicMpn("  stm32f103c8t6  ")).toBe("STM32F103C8T6");
    expect(() => normalizePublicMpn("   ")).toThrow(/required/i);
    expect(() => normalizePublicMpn("STM32<script>")).toThrow(/invalid/i);
    expect(() => normalizePublicMpn("A".repeat(101))).toThrow(/100/);
  });

  it("does not merge manufacturers and never leaks commercial fields", () => {
    const merged = mergeRawCatalogItems([
      { mpn: "X1", manufacturer: "Acme", description: "Acme part" },
      { mpn: "X1", manufacturer: "Zenith", description: "Other part" },
    ]);
    expect(merged?.manufacturer).toBe("Acme");
    const dto = mapRawItemToPublicProduct({
      mpn: "X1", manufacturer: "Acme", description: "desc", sourceProductId: "SUPPLIER-SKU",
      sourceUrl: "https://supplier.example/private",
      internalOffers: [{ price: 1.23, stock: 500, moq: 10, leadTimeDays: 14 }],
    });
    expect(JSON.stringify(dto)).not.toMatch(/price|stock|moq|leadTime|SUPPLIER-SKU|supplier\.example/i);
  });

  it("filters isCanonical, productTraceability, and other internal-looking spec keys out of the public DTO", () => {
    const dto = mapRawItemToPublicProduct({
      mpn: "X2",
      manufacturer: "Acme",
      specifications: { Resistance: "10k", Package: "0603", isCanonical: "true", productTraceability: "batch-9", supplierSku: "ABC-1" },
    });
    const names = dto.specifications.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["Resistance", "Package"]));
    expect(names).not.toEqual(expect.arrayContaining(["isCanonical", "productTraceability", "supplierSku"]));
  });

  it("returns a cached result without calling a provider", async () => {
    mocks.cacheGet.mockResolvedValue({
      value: {
        product: { mpn: "CACHED1", manufacturer: "Maker", productName: "Cached", specifications: [] },
        sources: [{ provider: "MOUSER", status: "FOUND" }],
      },
    });
    const result = await searchMpnAcrossProviders("CACHED1");
    expect(result.product?.mpn).toBe("CACHED1");
    expect(result.sources).toEqual([{ provider: "MOUSER", status: "FOUND" }]);
    expect(mocks.mouserFetch).not.toHaveBeenCalled();
    expect(mocks.digikeyFetch).not.toHaveBeenCalled();
    expect(mocks.element14Fetch).not.toHaveBeenCalled();
  });

  it("keeps sources cached alongside the product instead of expiring separately", async () => {
    mocks.mouserFetch.mockResolvedValue({ items: [item] });
    mocks.digikeyFetch.mockImplementation(noMatch);
    mocks.element14Fetch.mockImplementation(noMatch);
    await searchMpnAcrossProviders("STM32F103C8T6");
    const call = mocks.cacheSet.mock.calls.find((c) => c[0] === "public-mpn-search-product");
    expect(call?.[2]).toMatchObject({
      product: { mpn: "STM32F103C8T6" },
      sources: [
        { provider: "MOUSER", status: "FOUND" },
        { provider: "DIGIKEY", status: "NO_MATCH" },
        { provider: "ELEMENT14", status: "NO_MATCH" },
      ],
    });
    expect(mocks.cacheSet).toHaveBeenCalledTimes(1);
  });

  it("strips internal-looking spec keys from a stale cache entry written before the allowlist existed", async () => {
    mocks.cacheGet.mockResolvedValue({
      value: {
        product: {
          mpn: "STALE1", manufacturer: "Maker", productName: "Stale cached part",
          specifications: [{ name: "Resistance", value: "10k" }, { name: "isCanonical", value: "Y" }, { name: "productTraceability", value: "No" }],
        },
        sources: [],
      },
    });
    const result = await searchMpnAcrossProviders("STALE1");
    const names = result.product?.specifications.map((s) => s.name);
    expect(names).toEqual(["Resistance"]);
  });
});
