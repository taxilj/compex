import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, REQUEST_TIMEOUT_MS, apiFetchPublic } from "./client";
import { listCategories, listProducts, resetCategoryCache } from "./products";
import { listManufacturers } from "./manufacturers";

const ok = (data: unknown, meta?: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta }), { status: 200, headers: { "content-type": "application/json" } });

// A fetch that never answers but honours its AbortSignal, like the real one.
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  );
}

beforeEach(() => {
  resetCategoryCache();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("request timeout", () => {
  it("rejects a hung request with ApiError TIMEOUT instead of waiting forever", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const pending = apiFetchPublic("/api/products/lookup?mpn=X").catch((e: unknown) => e as ApiError);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    const err = await pending;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("TIMEOUT");
  });

  it("propagates a caller abort as AbortError (stale-request cancellation), not a timeout", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const pending = listProducts({ q: "abc" }, controller.signal).catch((e: unknown) => e as Error);
    controller.abort();
    const err = (await pending) as Error;
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err.name).toBe("AbortError");
  });

  it("does not retry a caller abort", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const pending = listProducts({}, controller.signal).catch((e: unknown) => e as Error);
    controller.abort();
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("bounded retry for public reads", () => {
  it("retries once after a 5xx and returns the recovered result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { code: "X", message: "boom" } }), { status: 503 }))
      .mockResolvedValueOnce(ok([{ mpn: "A" }], { total: 1, page: 1, limit: 20 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await listProducts({});
    expect(result.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry (bounded)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: false, error: { code: "X", message: "boom" } }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listProducts({})).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "VALIDATION_ERROR", message: "bad" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listProducts({ q: "x" })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("category cache", () => {
  it("dedupes concurrent calls into one request, then serves from cache (miss then hit)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([{ id: "c1", name: "A", children: [], _count: { products: 1 } }]));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([listCategories(), listCategories()]);
    expect(a).toBe(b);
    await listCategories();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("force refetches past the cache", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ok([]));
    vi.stubGlobal("fetch", fetchMock);
    await listCategories();
    await listCategories({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure, so the next call can recover", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => new Response("nope", { status: 400 }))
      .mockResolvedValueOnce(ok([{ id: "c1", name: "A", children: [], _count: { products: 0 } }]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listCategories()).rejects.toBeInstanceOf(ApiError);
    await expect(listCategories()).resolves.toHaveLength(1);
  });
});

describe("manufacturer list dedupe", () => {
  it("shares one request between identical concurrent calls", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => ok([], { total: 0, page: 1, limit: 20 }));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([listManufacturers({ limit: 20 }), listManufacturers({ limit: 20 })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await listManufacturers({ limit: 20 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("timeout covers the response body and is not retried", () => {
  it("times out when headers arrive but the body never finishes (no endless spinner)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "application/json" } }));
    }));
    const pending = apiFetchPublic("/api/products/lookup?mpn=X").catch((e: unknown) => e as ApiError);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    const err = await pending;
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("TIMEOUT");
  });

  it("does not retry a timeout (worst case stays one budget, not two)", async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const pending = listProducts({}).catch((e: unknown) => e as ApiError);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 2_000);
    const err = await pending;
    expect((err as ApiError).code).toBe("TIMEOUT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
