import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productFindMany: vi.fn(),
  catalogImportRunCreate: vi.fn(),
  catalogImportRunFindUnique: vi.fn(),
  catalogImportRunDelete: vi.fn(),
  incrementCounter: vi.fn(),
  runImport: vi.fn(),
  mouserFetch: vi.fn(),
  digikeyFetch: vi.fn(),
  element14Fetch: vi.fn(),
}));

vi.mock("../../src/config/env.js", () => ({
  env: {
    MOUSER_API_KEY: "mouser-key",
    DIGIKEY_CLIENT_ID: "dk-id",
    DIGIKEY_CLIENT_SECRET: "dk-secret",
    ELEMENT14_API_KEY: "e14-key",
  },
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    product: { findMany: mocks.productFindMany },
    catalogImportRun: {
      create: mocks.catalogImportRunCreate,
      findUnique: mocks.catalogImportRunFindUnique,
      delete: mocks.catalogImportRunDelete,
    },
  },
}));
vi.mock("../../src/lib/cache.js", () => ({
  incrementCounter: (...args: unknown[]) => mocks.incrementCounter(...args),
}));
vi.mock("../../src/modules/catalog-import/run-import.js", () => ({
  runImport: (...args: unknown[]) => mocks.runImport(...args),
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

const { resolveUnknownMpn } = await import("../../src/modules/catalog/product-on-demand.js");

function dbProduct(mpn: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-1",
    mpn,
    name: "Timer IC",
    description: "desc",
    specifications: {},
    packageType: "DIP-8",
    mountingType: null,
    lifecycleStatus: "ACTIVE",
    datasheetUrl: null,
    images: [],
    manufacturer: null,
    category: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.catalogImportRunCreate.mockResolvedValue({ id: "run-1" });
  mocks.catalogImportRunFindUnique.mockResolvedValue({ itemsProcessed: 0, itemsFailed: 0 });
  mocks.catalogImportRunDelete.mockResolvedValue(undefined);
  mocks.incrementCounter.mockResolvedValue(1); // well under the budget by default
});

describe("resolveUnknownMpn", () => {
  it("matches the database by normalizedMpn, not raw mpn, so a punctuation-variant spelling still hits an already-imported product", async () => {
    mocks.productFindMany.mockResolvedValue([dbProduct("ABC-123")]);

    await resolveUnknownMpn("abc 123");

    expect(mocks.productFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ normalizedMpn: "ABC123" }),
    }));
    expect(mocks.runImport).not.toHaveBeenCalled();
  });

  it("deletes the CatalogImportRun audit row for a genuine no-op NO_MATCH (garbage-MPN spam has no audit value)", async () => {
    mocks.productFindMany.mockResolvedValue([]);
    mocks.runImport.mockResolvedValue({ productIds: [] });
    mocks.catalogImportRunFindUnique.mockResolvedValue({ itemsProcessed: 0, itemsFailed: 0 });

    await resolveUnknownMpn("SPAMMEDFAKE");

    expect(mocks.catalogImportRunDelete).toHaveBeenCalled();
  });

  it("keeps the CatalogImportRun audit row when items were seen but rejected (real data-quality signal)", async () => {
    mocks.productFindMany.mockResolvedValue([]);
    mocks.runImport.mockResolvedValue({ productIds: [] });
    mocks.catalogImportRunFindUnique.mockResolvedValue({ itemsProcessed: 1, itemsFailed: 1 });

    await resolveUnknownMpn("REJECTEDROW");

    expect(mocks.catalogImportRunDelete).not.toHaveBeenCalled();
  });

  it("fails closed with RATE_LIMITED, never calling any provider, once the shared daily provider-call budget is exhausted", async () => {
    mocks.productFindMany.mockResolvedValue([]);
    mocks.incrementCounter.mockResolvedValue(301); // over the 300/day budget

    const result = await resolveUnknownMpn("OVERBUDGETPART");

    expect(result.product).toBeNull();
    expect(result.sources.every((s) => s.status === "RATE_LIMITED")).toBe(true);
    expect(mocks.runImport).not.toHaveBeenCalled();
  });

  it("returns the existing product immediately without calling any provider when the database already has it (race-safety recheck)", async () => {
    mocks.productFindMany.mockResolvedValue([dbProduct("RACEHIT")]);

    const result = await resolveUnknownMpn("RACEHIT");

    expect(result.product?.mpn).toBe("RACEHIT");
    expect(result.sources).toEqual([]);
    expect(mocks.runImport).not.toHaveBeenCalled();
  });

  it("fans out to all configured providers and persists a found item via the real upsert pipeline", async () => {
    mocks.productFindMany
      .mockResolvedValueOnce([]) // pre-check miss
      .mockResolvedValueOnce([dbProduct("NEWPART2")]); // post-import re-query
    mocks.runImport
      .mockResolvedValueOnce({ productIds: ["prod-1"] }) // MOUSER found it
      .mockResolvedValueOnce({ productIds: [] }) // DIGIKEY no match
      .mockResolvedValueOnce({ productIds: [] }); // ELEMENT14 no match

    const result = await resolveUnknownMpn("NEWPART2");

    expect(result.product?.mpn).toBe("NEWPART2");
    expect(result.sources).toEqual(expect.arrayContaining([
      { provider: "MOUSER", status: "FOUND" },
      { provider: "DIGIKEY", status: "NO_MATCH" },
      { provider: "ELEMENT14", status: "NO_MATCH" },
    ]));
    expect(mocks.runImport).toHaveBeenCalledTimes(3);
  });

  it("never lets one provider's failure block the others (one error, one success)", async () => {
    mocks.productFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([dbProduct("PARTIALOK")]);
    mocks.runImport
      .mockRejectedValueOnce(new Error("Mouser 500"))
      .mockResolvedValueOnce({ productIds: ["prod-1"] })
      .mockResolvedValueOnce({ productIds: [] });

    const result = await resolveUnknownMpn("PARTIALOK");

    expect(result.sources).toEqual(expect.arrayContaining([
      { provider: "MOUSER", status: "ERROR" },
      { provider: "DIGIKEY", status: "FOUND" },
    ]));
    expect(result.product?.mpn).toBe("PARTIALOK");
  });

  it("reports RATE_LIMITED distinctly from a generic ERROR", async () => {
    mocks.productFindMany.mockResolvedValue([]);
    const rateLimited = Object.assign(new Error("Too many requests"), { code: "RATE_LIMITED" });
    mocks.runImport.mockRejectedValue(rateLimited);

    const result = await resolveUnknownMpn("RATELIMITEDPART");

    expect(result.product).toBeNull();
    expect(result.sources.every((s) => s.status === "RATE_LIMITED")).toBe(true);
  });

  it("returns an honest null with NO_MATCH sources when every provider genuinely has nothing, without fabricating a product", async () => {
    mocks.productFindMany.mockResolvedValue([]);
    mocks.runImport.mockResolvedValue({ productIds: [] });

    const result = await resolveUnknownMpn("TRULYUNKNOWN");

    expect(result.product).toBeNull();
    expect(result.sources.every((s) => s.status === "NO_MATCH")).toBe(true);
  });

  it("treats a provider 404 as a definitive NO_MATCH, not a transient failure", async () => {
    mocks.productFindMany.mockResolvedValue([]);
    mocks.runImport.mockRejectedValue(Object.assign(new Error("Provider request failed with status 404"), { statusCode: 404 }));

    const result = await resolveUnknownMpn("UNKNOWN404");

    expect(result.product).toBeNull();
    expect(result.sources.every((s) => s.status === "NO_MATCH")).toBe(true);
  });

  it("contains an unexpected resolver failure as a safe unavailable response for ABC123", async () => {
    mocks.productFindMany.mockRejectedValue(new Error("database credentials at private-url.example"));

    const result = await resolveUnknownMpn("ABC123");

    expect(result).toEqual({
      product: null,
      sources: [
        { provider: "MOUSER", status: "ERROR" },
        { provider: "DIGIKEY", status: "ERROR" },
        { provider: "ELEMENT14", status: "ERROR" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private-url");
  });

  it("returns a structured safe response when every provider rejects malformed data", async () => {
    mocks.productFindMany.mockResolvedValue([]);
    mocks.runImport.mockRejectedValue(new SyntaxError("Unexpected provider response"));

    const result = await resolveUnknownMpn("MALFORMEDPART");

    expect(result.product).toBeNull();
    expect(result.sources.every((s) => s.status === "ERROR")).toBe(true);
  });

  it("bounds a hung provider call with a real timeout instead of waiting forever", async () => {
    vi.useFakeTimers();
    try {
      mocks.productFindMany.mockResolvedValue([]);
      mocks.runImport.mockReturnValue(new Promise(() => {})); // never resolves

      const pending = resolveUnknownMpn("HANGINGPROVIDER");
      await vi.advanceTimersByTimeAsync(8_001);
      const result = await pending;

      expect(result.product).toBeNull();
      expect(result.sources.every((s) => s.status === "TIMEOUT")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("deduplicates concurrent requests for the same normalized MPN into a single provider fan-out", async () => {
    mocks.productFindMany.mockResolvedValue([]);
    let resolveRunImport!: (v: { productIds: string[] }) => void;
    mocks.runImport.mockReturnValue(new Promise((resolve) => { resolveRunImport = resolve; }));

    const first = resolveUnknownMpn("dup-mpn-123");
    const second = resolveUnknownMpn("DUP-MPN-123"); // same normalized key, different case

    resolveRunImport({ productIds: [] });
    await Promise.all([first, second]);

    // 3 providers x 1 shared resolution, not x2 for the two callers.
    expect(mocks.runImport).toHaveBeenCalledTimes(3);
  });
});
