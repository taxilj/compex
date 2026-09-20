import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// SECURITY: this suite must never trigger a real outbound call to Mouser,
// DigiKey, or element14. The repo's own `.env` (loaded as Vite's env
// fallback alongside `.env.test.local` under NODE_ENV=test) carries the
// owner's real supplier credentials, so without this mock,
// resolveUnknownMpn() would see DIGIKEY/ELEMENT14 as "configured" and fire
// real provider requests for the deliberately-fake MPNs below -- exactly
// what the "do not mass-query supplier APIs" rule forbids. Overriding just
// these three fields (via `importOriginal`, so every other env value stays
// real) forces the "no providers configured" branch deterministically,
// with zero real network calls, regardless of what's in `.env`.
vi.mock("../../src/config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/config/env.js")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      MOUSER_API_KEY: undefined,
      DIGIKEY_CLIENT_ID: undefined,
      DIGIKEY_CLIENT_SECRET: undefined,
      ELEMENT14_API_KEY: undefined,
    },
  };
});

import { createTestApp, cleanDb, createAdminAndLogin } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";

// This suite exercises the public, unauthenticated exact-MPN lookup and
// on-demand resolver (GET /:mpn, POST /:mpn/resolve) with the edge cases the
// owner explicitly called out: an MPN with no catalogued match, a blank/
// whitespace-only MPN, and confirming the resolver degrades safely (never a
// 5xx, never an uncaught exception) and that /health and a normal valid
// lookup both keep working right after a failed one.

let app: FastifyInstance;

beforeAll(async () => { app = await createTestApp(); });
afterAll(async () => { await app.close(); await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

async function seedKnownProduct(adminToken: string) {
  const mfr = await app.inject({
    method: "POST",
    url: "/api/v1/admin/manufacturers",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: "STMicroelectronics", slug: "stmicroelectronics" },
  });
  const manufacturerId = mfr.json().data.id;
  const product = await app.inject({
    method: "POST",
    url: "/api/v1/admin/products",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { mpn: "STM32F103C8T6", name: "ARM Cortex-M3 MCU", manufacturerId },
  });
  expect(product.statusCode).toBe(201);
}

describe("public exact-MPN lookup and on-demand resolver", () => {
  it("404s a genuinely unknown MPN, then resolves it on-demand without crashing (no real provider calls -- credentials mocked out above)", async () => {
    const notFound = await app.inject({ method: "GET", url: "/api/v1/products/ABC123" });
    expect(notFound.statusCode).toBe(404);

    const resolved = await app.inject({ method: "POST", url: "/api/v1/products/ABC123/resolve" });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().data).toMatchObject({ product: null, sources: [] });
  });

  it("rejects a blank MPN and a whitespace-only MPN with 400, not a crash", async () => {
    const blank = await app.inject({ method: "GET", url: "/api/v1/products/%20" });
    expect(blank.statusCode).toBe(400);

    const whitespace = await app.inject({ method: "GET", url: "/api/v1/products/%20%20%20" });
    expect(whitespace.statusCode).toBe(400);

    const resolveBlank = await app.inject({ method: "POST", url: "/api/v1/products/%20/resolve" });
    expect(resolveBlank.statusCode).toBe(400);
  });

  it("keeps /health at 200 immediately after a failed lookup", async () => {
    const failed = await app.inject({ method: "GET", url: "/api/v1/products/DEFINITELY-UNKNOWN-MPN" });
    expect(failed.statusCode).toBe(404);

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: "ok" });
  });

  it("still resolves a valid, already-catalogued MPN right after a failed lookup for a different MPN", async () => {
    const admin = await createAdminAndLogin(app, "mpn-resolver-qa@invalid.test");
    await seedKnownProduct(admin.accessToken);

    const failed = await app.inject({ method: "GET", url: "/api/v1/products/NOT-A-REAL-PART" });
    expect(failed.statusCode).toBe(404);

    const valid = await app.inject({ method: "GET", url: "/api/v1/products/STM32F103C8T6" });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().data.mpn).toBe("STM32F103C8T6");
  });
});

describe("catalogue cache invalidation by the public resolver", () => {
  it("does not flush the catalogue cache when a resolve imports nothing (cache-flush DoS guard)", async () => {
    const { cacheGet } = await import("../../src/lib/cache.js");
    const before = await cacheGet("catalog", "version");
    const res = await app.inject({ method: "POST", url: "/api/v1/products/NOPE-FLUSH-1/resolve" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.product).toBeNull();
    expect(await cacheGet("catalog", "version")).toEqual(before);
  });
});
