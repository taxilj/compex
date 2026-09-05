import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mouserFetch: vi.fn(),
  digikeyFetch: vi.fn(),
  element14Fetch: vi.fn(),
  isNexarConfigured: vi.fn(),
  lookupPublicProduct: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
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
vi.mock("../../src/modules/catalog-import/fetchers/nexar-client.js", () => ({
  isNexarConfigured: mocks.isNexarConfigured,
}));
vi.mock("../../src/lib/cache.js", () => ({
  cacheGet: (...args: unknown[]) => mocks.cacheGet(...args),
  cacheSet: (...args: unknown[]) => mocks.cacheSet(...args),
}));
vi.mock("../../src/modules/catalog/public-product-lookup.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/modules/catalog/public-product-lookup.js")>(
    "../../src/modules/catalog/public-product-lookup.js",
  );
  return { ...actual, lookupPublicProduct: (...args: unknown[]) => mocks.lookupPublicProduct(...args) };
});

const {
  searchMpnAcrossProviders,
  mergeRawCatalogItems,
  mapRawItemToPublicProduct,
} = await import("../../src/modules/catalog/mpn-search-orchestrator.js");

const RATE_LIMITED_ERROR = Object.assign(new Error("Too many requests, please try again later"), { code: "RATE_LIMITED" });
const TIMEOUT_MPN = "TIMEOUT-TRIGGER"; // real timeouts are exercised by making the mock hang past the 4s window

const stmItem = {
  mpn: "STM32F103C8T6",
  manufacturer: "STMicroelectronics",
  description: "32-bit ARM Cortex-M3 microcontroller",
  category: "Microcontrollers",
  datasheetUrl: "https://st.com/stm32.pdf",
  images: ["https://img.example.com/stm32.jpg"],
  specifications: { Package: "LQFP48", rohsStatus: "RoHS Compliant" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cacheGet.mockResolvedValue(null);
  mocks.cacheSet.mockResolvedValue(undefined);
  mocks.isNexarConfigured.mockReturnValue(true);
});

function neverMatch() {
  return Promise.resolve({ items: [] });
}

describe("Nexar fallback gating (Phase 12, scenarios A-E)", () => {
  it("A: all three primaries FOUND -> Nexar must not run", async () => {
    mocks.mouserFetch.mockResolvedValue({ items: [stmItem] });
    mocks.digikeyFetch.mockResolvedValue({ items: [stmItem] });
    mocks.element14Fetch.mockResolvedValue({ items: [stmItem] });

    const result = await searchMpnAcrossProviders("STM32F103C8T6");

    expect(mocks.lookupPublicProduct).not.toHaveBeenCalled();
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    expect(result.sources.find((s) => s.provider === "NEXAR")).toBeUndefined();
  });

  it("B: Mouser FOUND, DigiKey ERROR, Element14 NO_MATCH -> Nexar must not run", async () => {
    mocks.mouserFetch.mockResolvedValue({ items: [stmItem] });
    mocks.digikeyFetch.mockRejectedValue(new Error("DigiKey API request failed with status 500"));
    mocks.element14Fetch.mockImplementation(neverMatch);

    const result = await searchMpnAcrossProviders("STM32F103C8T6");

    expect(mocks.lookupPublicProduct).not.toHaveBeenCalled();
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    const digikey = result.sources.find((s) => s.provider === "DIGIKEY");
    expect(digikey?.status).toBe("ERROR");
  });

  it("C: Mouser NO_MATCH, DigiKey NO_MATCH, Element14 NO_MATCH -> Nexar must run", async () => {
    mocks.mouserFetch.mockImplementation(neverMatch);
    mocks.digikeyFetch.mockImplementation(neverMatch);
    mocks.element14Fetch.mockImplementation(neverMatch);
    mocks.lookupPublicProduct.mockResolvedValue({ mpn: "STM32F103C8T6", manufacturer: "STMicroelectronics", productName: "MCU", specifications: [] });

    const result = await searchMpnAcrossProviders("STM32F103C8T6");

    expect(mocks.lookupPublicProduct).toHaveBeenCalledTimes(1);
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    expect(result.sources.find((s) => s.provider === "NEXAR")?.status).toBe("FOUND");
  });

  it("D: Mouser TIMEOUT, DigiKey NO_MATCH, Element14 NO_MATCH -> Nexar must not run", async () => {
    mocks.mouserFetch.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ items: [] }), 10_000)));
    mocks.digikeyFetch.mockImplementation(neverMatch);
    mocks.element14Fetch.mockImplementation(neverMatch);

    const result = await searchMpnAcrossProviders("STM32F103C8T6");

    expect(mocks.lookupPublicProduct).not.toHaveBeenCalled();
    expect(result.product).toBeNull();
    expect(result.sources.find((s) => s.provider === "MOUSER")?.status).toBe("TIMEOUT");
  }, 10_000);

  it("E: Mouser RATE_LIMITED, DigiKey NO_MATCH, Element14 NO_MATCH -> Nexar must not run", async () => {
    mocks.mouserFetch.mockRejectedValue(RATE_LIMITED_ERROR);
    mocks.digikeyFetch.mockImplementation(neverMatch);
    mocks.element14Fetch.mockImplementation(neverMatch);

    const result = await searchMpnAcrossProviders("STM32F103C8T6");

    expect(mocks.lookupPublicProduct).not.toHaveBeenCalled();
    expect(result.product).toBeNull();
    expect(result.sources.find((s) => s.provider === "MOUSER")?.status).toBe("RATE_LIMITED");
  });
});

describe("canonical multi-source merge and public DTO", () => {
  it("merges facts from multiple providers finding the same MPN + manufacturer without dropping good data", () => {
    const merged = mergeRawCatalogItems([
      { mpn: "X1", manufacturer: "Acme", description: "short desc" },
      { mpn: "X1", manufacturer: "Acme", description: "a much longer, more complete description of X1", datasheetUrl: "https://acme.example/x1.pdf" },
    ]);
    expect(merged?.description).toBe("a much longer, more complete description of X1");
    expect(merged?.datasheetUrl).toBe("https://acme.example/x1.pdf");
  });

  it("never silently merges the same MPN across two different manufacturers", () => {
    const merged = mergeRawCatalogItems([
      { mpn: "X1", manufacturer: "Acme Corp", description: "Acme's part" },
      { mpn: "X1", manufacturer: "Zenith Inc", description: "Zenith's unrelated part" },
    ]);
    // Exactly one manufacturer's data becomes canonical; the other is not folded in.
    expect(merged?.manufacturer).toBe("Acme Corp");
    expect(merged?.description).toBe("Acme's part");
  });

  it("never overwrites a good existing value with a later null/empty one", () => {
    const merged = mergeRawCatalogItems([
      { mpn: "X1", manufacturer: "Acme", category: "Resistors" },
      { mpn: "X1", manufacturer: "Acme", category: undefined },
    ]);
    expect(merged?.category).toBe("Resistors");
  });

  it("removes pricing/stock/MOQ/lead-time/supplier SKU/URL and raw payload data from the public DTO", () => {
    const raw = {
      mpn: "X1",
      manufacturer: "Acme",
      description: "desc",
      sourceProductId: "ACME-SKU-123",
      sourceUrl: "https://mouser.com/private-listing",
      internalOffers: [{ price: 1.23, stock: 500, moq: 10, leadTimeDays: 14 }],
    } as never;
    const dto = mapRawItemToPublicProduct(raw);
    const json = JSON.stringify(dto);
    expect(json).not.toMatch(/price|stock|moq|leadTime|ACME-SKU-123|private-listing/i);
  });

  it("derives compliance entries from specification names without leaking raw spec objects", () => {
    const dto = mapRawItemToPublicProduct(stmItem as never);
    expect(dto.compliance).toEqual(["RoHS Compliant"]);
    expect(dto.specifications).toEqual(
      expect.arrayContaining([{ name: "Package", value: "LQFP48" }, { name: "rohsStatus", value: "RoHS Compliant" }]),
    );
  });
});

describe("caching", () => {
  it("a cache hit returns the cached result without calling any provider", async () => {
    mocks.cacheGet.mockImplementation((namespace: string) =>
      namespace === "public-mpn-search-product"
        ? Promise.resolve({ value: { mpn: "CACHED1", manufacturer: "Maker", productName: "Cached", specifications: [] } })
        : Promise.resolve({ value: [{ provider: "MOUSER", status: "FOUND" }] }),
    );

    const result = await searchMpnAcrossProviders("cached1");

    expect(result.product?.mpn).toBe("CACHED1");
    expect(mocks.mouserFetch).not.toHaveBeenCalled();
    expect(mocks.digikeyFetch).not.toHaveBeenCalled();
    expect(mocks.element14Fetch).not.toHaveBeenCalled();
  });

  it("does not poison the product-facts cache when a provider errors with no confirmed result", async () => {
    mocks.mouserFetch.mockRejectedValue(new Error("Mouser API request failed with status 500"));
    mocks.digikeyFetch.mockImplementation(neverMatch);
    mocks.element14Fetch.mockImplementation(neverMatch);

    await searchMpnAcrossProviders("STM32F103C8T6");

    const productCacheCalls = mocks.cacheSet.mock.calls.filter((call) => call[0] === "public-mpn-search-product");
    expect(productCacheCalls).toHaveLength(0);
    // Provider status is still cached (short TTL) so the UI/telemetry has it.
    const statusCacheCalls = mocks.cacheSet.mock.calls.filter((call) => call[0] === "public-mpn-search-status");
    expect(statusCacheCalls).toHaveLength(1);
  });

  it("caches a confirmed no-result (all primaries + Nexar NO_MATCH) as product facts", async () => {
    mocks.mouserFetch.mockImplementation(neverMatch);
    mocks.digikeyFetch.mockImplementation(neverMatch);
    mocks.element14Fetch.mockImplementation(neverMatch);
    mocks.lookupPublicProduct.mockResolvedValue(null);

    await searchMpnAcrossProviders("NOPE1");

    const productCacheCalls = mocks.cacheSet.mock.calls.filter((call) => call[0] === "public-mpn-search-product");
    expect(productCacheCalls).toHaveLength(1);
    expect(productCacheCalls[0][2]).toBeNull();
  });
});

describe("no-result / duplicate prevention", () => {
  it("returns a clean null product (no throw) when every source reports no match", async () => {
    mocks.mouserFetch.mockImplementation(neverMatch);
    mocks.digikeyFetch.mockImplementation(neverMatch);
    mocks.element14Fetch.mockImplementation(neverMatch);
    mocks.lookupPublicProduct.mockResolvedValue(null);

    const result = await searchMpnAcrossProviders("NOPE2");
    expect(result.product).toBeNull();
  });

  it("de-duplicates a single canonical product even when all three providers find it (no duplicate cards)", async () => {
    mocks.mouserFetch.mockResolvedValue({ items: [stmItem] });
    mocks.digikeyFetch.mockResolvedValue({ items: [stmItem] });
    mocks.element14Fetch.mockResolvedValue({ items: [stmItem] });

    const result = await searchMpnAcrossProviders("STM32F103C8T6");
    expect(result.product?.mpn).toBe("STM32F103C8T6");
    // Exactly one product object is returned, not an array/list of matches.
    expect(Array.isArray(result.product)).toBe(false);
  });
});
