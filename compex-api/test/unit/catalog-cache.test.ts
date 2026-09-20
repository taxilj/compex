import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ map: new Map<string, unknown>(), fail: false, hang: false }));

vi.mock("../../src/lib/cache.js", () => ({
  cacheGet: vi.fn(async (ns: string, key: string) => {
    if (store.hang) return new Promise(() => undefined);
    if (store.fail) throw new Error("redis down");
    const value = store.map.get(`${ns}:${key}`);
    return value === undefined ? null : { value, cachedAt: "now" };
  }),
  cacheSet: vi.fn(async (ns: string, key: string, value: unknown) => {
    if (store.fail) throw new Error("redis down");
    store.map.set(`${ns}:${key}`, value);
  }),
}));

import { bumpCatalogVersion, cachedCatalog, catalogKey } from "../../src/modules/catalog/catalog-cache.js";

beforeEach(() => {
  store.map.clear();
  store.fail = false;
  store.hang = false;
});

describe("cachedCatalog", () => {
  it("cache miss loads once, cache hit skips the loader", async () => {
    const load = vi.fn(async () => ["a"]);
    expect(await cachedCatalog("categories", load)).toEqual(["a"]);
    expect(await cachedCatalog("categories", load)).toEqual(["a"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("bumping the catalog version invalidates cached entries", async () => {
    const load = vi.fn().mockResolvedValueOnce(["old"]).mockResolvedValueOnce(["new"]);
    await cachedCatalog("categories", load);
    await bumpCatalogVersion();
    expect(await cachedCatalog("categories", load)).toEqual(["new"]);
  });

  it("falls back to the loader when Redis errors", async () => {
    store.fail = true;
    const load = vi.fn(async () => ["db"]);
    expect(await cachedCatalog("categories", load)).toEqual(["db"]);
  });

  it("does not hang when Redis never answers", async () => {
    store.hang = true;
    const started = Date.now();
    expect(await cachedCatalog("categories", async () => ["db"])).toEqual(["db"]);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("coalesces concurrent misses into one loader call", async () => {
    const load = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return ["x"];
    });
    const results = await Promise.all([cachedCatalog("k", load), cachedCatalog("k", load), cachedCatalog("k", load)]);
    expect(results).toEqual([["x"], ["x"], ["x"]]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("propagates loader errors without caching them", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("db")).mockResolvedValueOnce(["ok"]);
    await expect(cachedCatalog("k2", load)).rejects.toThrow("db");
    expect(await cachedCatalog("k2", load)).toEqual(["ok"]);
  });
});

describe("catalogKey", () => {
  it("is stable across param order, case and blanks", () => {
    expect(catalogKey("products", { q: "LM317", page: 1, categoryId: "" })).toBe(catalogKey("products", { page: 1, q: "lm317" }));
  });
  it("differs by manufacturer filter", () => {
    expect(catalogKey("products", { manufacturerId: "a" })).not.toBe(catalogKey("products", { manufacturerId: "b" }));
  });
});

describe("catalogKey case rules", () => {
  it("keeps case-sensitive filters distinct (only the search text is case-insensitive)", () => {
    expect(catalogKey("products", { packageType: "SOIC-8" })).not.toBe(catalogKey("products", { packageType: "soic-8" }));
  });
});

describe("cachedCatalog loader budget", () => {
  it("times out a hung loader and frees the key so the next request can recover", async () => {
    vi.useFakeTimers();
    try {
      const hung = cachedCatalog("hang", () => new Promise<string[]>(() => undefined)).catch((e: unknown) => e as Error);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(((await hung) as Error).message).toMatch(/timed out/i);
    } finally {
      vi.useRealTimers();
    }
    expect(await cachedCatalog("hang", async () => ["recovered"])).toEqual(["recovered"]);
  });
});
