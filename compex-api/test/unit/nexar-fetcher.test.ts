import { describe, it, expect, beforeEach, vi } from "vitest";

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

const { createNexarFetcher } = await import("../../src/modules/catalog-import/fetchers/nexar-fetcher.js");

function supSearchMpnResult(parts: Array<Record<string, unknown>>) {
  return { supSearchMpn: { hits: parts.length, results: parts.map((part) => ({ part })) } };
}

beforeEach(() => {
  nexarGraphQLMock.mockReset();
  cacheGetMock.mockReset();
  cacheSetMock.mockReset();
  cacheGetMock.mockResolvedValue(null); // default: cache miss
  cacheSetMock.mockResolvedValue(undefined);
});

describe("createNexarFetcher - exact-MPN matching", () => {
  it("maps a single exact match into one RawCatalogItem carrying internalOffers, never a bare/empty item on a real match", async () => {
    nexarGraphQLMock.mockResolvedValue(
      supSearchMpnResult([
        {
          mpn: "STM32F103C8T6",
          manufacturer: { name: "STMicroelectronics" },
          shortDescription: "32-bit MCU",
          sellers: [{ company: { name: "Digi-Key" }, offers: [{ sku: "497-ND", inventoryLevel: 500 }] }],
        },
      ]),
    );

    const result = await createNexarFetcher("STM32F103C8T6").fetch();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].mpn).toBe("STM32F103C8T6");
    expect(result.items[0].manufacturer).toBe("STMicroelectronics");
    expect(result.items[0].internalOffers).toEqual([
      expect.objectContaining({ seller: "Digi-Key", sku: "497-ND", inventoryLevel: 500 }),
    ]);
  });

  it("filters out near-matches (different MPN) and keeps only the normalized exact match", async () => {
    nexarGraphQLMock.mockResolvedValue(
      supSearchMpnResult([
        { mpn: "STM32F103C8T6-TR" }, // packaging variant, not an exact match
        { mpn: "stm32f103c8t6" }, // exact once normalized (case/formatting-insensitive)
      ]),
    );

    const result = await createNexarFetcher("STM32F103C8T6").fetch();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].mpn).toBe("stm32f103c8t6");
  });

  it("returns a clean empty result (no product found) when Nexar has no exact match, instead of throwing", async () => {
    nexarGraphQLMock.mockResolvedValue(supSearchMpnResult([{ mpn: "SOMETHING-ELSE" }]));
    const result = await createNexarFetcher("NOT-A-REAL-MPN").fetch();
    expect(result.items).toEqual([]);
  });

  it("returns a clean empty result when Nexar has zero hits", async () => {
    nexarGraphQLMock.mockResolvedValue(supSearchMpnResult([]));
    const result = await createNexarFetcher("NOTHING").fetch();
    expect(result.items).toEqual([]);
  });

  it("rejects a blank MPN before ever calling the network or cache", async () => {
    await expect(createNexarFetcher("   ").fetch()).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(nexarGraphQLMock).not.toHaveBeenCalled();
    expect(cacheGetMock).not.toHaveBeenCalled();
  });
});

describe("createNexarFetcher - caching", () => {
  it("returns the cached result and never calls Nexar on a cache hit", async () => {
    cacheGetMock.mockResolvedValue({ value: { items: [{ mpn: "CACHED1" }] } });

    const result = await createNexarFetcher("CACHED1").fetch();
    expect(result.items).toEqual([{ mpn: "CACHED1" }]);
    expect(nexarGraphQLMock).not.toHaveBeenCalled();
  });

  it("caches a successful lookup under the normalized MPN with the configured TTL", async () => {
    nexarGraphQLMock.mockResolvedValue(supSearchMpnResult([{ mpn: "STM32-F103" }]));

    await createNexarFetcher("stm32 f103").fetch();

    expect(cacheSetMock).toHaveBeenCalledTimes(1);
    const [namespace, key, , ttlSeconds] = cacheSetMock.mock.calls[0];
    expect(namespace).toBe("nexar-mpn-lookup");
    expect(key).toBe("STM32F103"); // normalizeMpn() strips spaces/punctuation and upper-cases
    expect(ttlSeconds).toBeGreaterThan(0);
  });

  it("never caches a failed lookup, so a transient outage cannot poison the cache", async () => {
    nexarGraphQLMock.mockRejectedValue(Object.assign(new Error("upstream outage"), { code: "SERVICE_UNAVAILABLE" }));

    await expect(createNexarFetcher("ANYPART").fetch()).rejects.toThrow("upstream outage");
    expect(cacheSetMock).not.toHaveBeenCalled();
  });
});
