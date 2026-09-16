import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mocks = vi.hoisted(() => ({
  anyPrimaryConfigured: vi.fn(),
  searchMpnAcrossProviders: vi.fn(),
  resolveUnknownMpn: vi.fn(),
}));

vi.mock("../../src/modules/catalog/mpn-search-orchestrator.js", () => ({
  anyPrimaryConfigured: mocks.anyPrimaryConfigured,
  searchMpnAcrossProviders: mocks.searchMpnAcrossProviders,
}));
vi.mock("../../src/modules/catalog/product-on-demand.js", () => ({
  resolveUnknownMpn: mocks.resolveUnknownMpn,
}));

import { productsRoutes } from "../../src/modules/catalog/products.routes.js";

describe("GET /products/lookup", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    vi.clearAllMocks();
  });

  async function app() {
    const instance = Fastify();
    apps.push(instance);
    await instance.register(rateLimit);
    instance.setErrorHandler((error, _request, reply) => {
      if (error instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request data" },
        });
      }
      const appError = error as { statusCode?: number; code?: string; message: string };
      return reply.status(appError.statusCode ?? 500).send({
        success: false,
        error: { code: appError.code ?? "SERVER_ERROR", message: appError.message },
      });
    });
    await instance.register(productsRoutes, { prefix: "/products" });
    instance.get("/health", async () => ({ status: "ok" }));
    return instance;
  }

  it("returns an honest configuration error without invoking the orchestrator when no provider credentials exist", async () => {
    mocks.anyPrimaryConfigured.mockReturnValue(false);
    const response = await (await app()).inject({ method: "GET", url: "/products/lookup?mpn=STM32F103C8T6" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ success: false, error: { code: "SEARCH_NOT_CONFIGURED", message: "Live product lookup is not configured." } });
    expect(mocks.searchMpnAcrossProviders).not.toHaveBeenCalled();
  });

  it("returns 200 with a null product and provider sources for a confirmed no-match (not a 404)", async () => {
    mocks.anyPrimaryConfigured.mockReturnValue(true);
    mocks.searchMpnAcrossProviders.mockResolvedValue({
      product: null,
      sources: [
        { provider: "MOUSER", status: "NO_MATCH" },
        { provider: "DIGIKEY", status: "NO_MATCH" },
        { provider: "ELEMENT14", status: "NO_MATCH" },
      ],
    });
    const response = await (await app()).inject({ method: "GET", url: "/products/lookup?mpn=NO-SUCH-PART" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.product).toBeNull();
    expect(response.json().data.sources).toHaveLength(3);
  });

  it("returns 200 with product null and partial-failure sources when providers error, rather than a hard failure", async () => {
    mocks.anyPrimaryConfigured.mockReturnValue(true);
    mocks.searchMpnAcrossProviders.mockResolvedValue({
      product: null,
      sources: [
        { provider: "MOUSER", status: "ERROR" },
        { provider: "DIGIKEY", status: "NO_MATCH" },
        { provider: "ELEMENT14", status: "NO_MATCH" },
      ],
    });
    const response = await (await app()).inject({ method: "GET", url: "/products/lookup?mpn=STM32F103C8T6" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.sources.some((s: { status: string }) => s.status === "ERROR")).toBe(true);
  });

  it("maps an unexpected orchestrator failure to a safe public message", async () => {
    mocks.anyPrimaryConfigured.mockReturnValue(true);
    mocks.searchMpnAcrossProviders.mockRejectedValue(new Error("upstream body with sensitive internal detail"));
    const response = await (await app()).inject({ method: "GET", url: "/products/lookup?mpn=STM32F103C8T6" });
    expect(response.statusCode).toBe(503);
    expect(JSON.stringify(response.json())).not.toContain("sensitive internal detail");
  });

  it("does not expose forbidden fields in its successful response", async () => {
    mocks.anyPrimaryConfigured.mockReturnValue(true);
    mocks.searchMpnAcrossProviders.mockResolvedValue({
      product: { mpn: "X1", manufacturer: "Maker", productName: "Part", specifications: [] },
      sources: [{ provider: "MOUSER", status: "FOUND" }],
    });
    const response = await (await app()).inject({ method: "GET", url: "/products/lookup?mpn=X1" });
    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(response.json())).not.toMatch(/price|stock|inventory|moq|lead.?time|supplier|secret/i);
  });

  it("returns ABC123's structured unavailable result and remains healthy for the next valid MPN", async () => {
    mocks.resolveUnknownMpn
      .mockResolvedValueOnce({ product: null, sources: [{ provider: "DIGIKEY", status: "ERROR" }] })
      .mockResolvedValueOnce({ product: { id: "p-1", mpn: "TLC555CP" }, sources: [{ provider: "DIGIKEY", status: "FOUND" }] });
    const instance = await app();

    const unknown = await instance.inject({ method: "POST", url: "/products/ABC123/resolve" });
    const health = await instance.inject({ method: "GET", url: "/health" });
    const valid = await instance.inject({ method: "POST", url: "/products/TLC555CP/resolve" });

    expect(unknown.statusCode).toBe(200);
    expect(unknown.json().data.product).toBeNull();
    expect(unknown.json().data.sources[0].status).toBe("ERROR");
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().data.product.mpn).toBe("TLC555CP");
  });

  it("rejects empty and malformed resolver MPNs before provider resolution", async () => {
    const instance = await app();

    const empty = await instance.inject({ method: "POST", url: "/products/%20/resolve" });
    const invalid = await instance.inject({ method: "POST", url: "/products/%21%21%21/resolve" });

    expect(empty.statusCode).toBe(400);
    expect(invalid.statusCode).toBe(400);
    expect(mocks.resolveUnknownMpn).not.toHaveBeenCalled();
  });
});
