import diagnosticsChannel from "node:diagnostics_channel";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Locks in the CURRENT admin permission model, route by route (Phase 5 F5). It runs the real
// app with the real `authenticate` and `requireRole` guards, but replaces every route handler
// with a stub, so no database, supplier API or Redis is touched: a 200 here means "the guards
// let this role through", nothing more. Per-field rules inside a handler (for example the
// ADMIN-account guard in admin.users.routes.ts) are covered in their own tests.
//
// If you add an admin route that only ADMIN should reach, add it to ADMIN_ONLY below; if this
// test fails on a new route, the route's guard is not what you intended.
vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unused_test";
  process.env.JWT_SECRET = "placeholder-secret-placeholder-secret-0001";
  process.env.JWT_REFRESH_SECRET = "placeholder-secret-placeholder-secret-0002";
});

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("../../src/lib/prisma.js", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
// A successful catalogue write would otherwise bump the cache version in a real Redis.
vi.mock("../../src/modules/catalog/catalog-cache.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/modules/catalog/catalog-cache.js")>()),
  bumpCatalogVersion: vi.fn(),
}));

import { buildApp } from "../../src/app.js";
import { signAccessToken } from "../../src/lib/jwt.js";

type Role = "CUSTOMER" | "STAFF" | "ADMIN";
const ADMIN_ONLY = new Set(["GET /api/v1/admin/settings/client-ip"]);
const UUID = "00000000-0000-4000-8000-000000000001";

interface CapturedRoute { method: string; url: string }
const captured: CapturedRoute[] = [];

let app: FastifyInstance;
let currentRole: Role = "STAFF";
let requestCounter = 0;

beforeAll(async () => {
  const subscriber = (message: unknown) => {
    const { fastify } = message as { fastify: FastifyInstance };
    fastify.addHook("onRoute", (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) {
        if (method !== "HEAD" && method !== "OPTIONS") captured.push({ method, url: route.url });
      }
      if (route.url.startsWith("/api/v1/admin/")) route.handler = async () => ({ reached: true });
    });
  };
  diagnosticsChannel.subscribe("fastify.initialization", subscriber);
  try {
    app = await buildApp();
  } finally {
    diagnosticsChannel.unsubscribe("fastify.initialization", subscriber);
  }
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  mocks.findUnique.mockImplementation(async () => ({ role: currentRole, status: "ACTIVE" }));
});

const adminRoutes = () => [...new Map(
  captured.filter((r) => r.url.startsWith("/api/v1/admin/")).map((r) => [`${r.method} ${r.url}`, r]),
).values()];

async function call(route: CapturedRoute, role: Role | null) {
  currentRole = role ?? "STAFF";
  requestCounter += 1;
  const headers: Record<string, string> = {};
  if (role) headers.authorization = `Bearer ${signAccessToken({ sub: UUID, role, customerId: null, companyId: null } as never)}`;
  const hasBody = !["GET", "DELETE"].includes(route.method);
  return app.inject({
    method: route.method as "GET",
    url: route.url.replace(/:[A-Za-z]+/g, UUID),
    headers: hasBody ? { ...headers, "content-type": "application/json" } : headers,
    payload: hasBody ? "{}" : undefined,
    // A distinct client address per request keeps the global rate limit out of the way.
    remoteAddress: `10.1.${Math.floor(requestCounter / 250)}.${(requestCounter % 250) + 1}`,
  });
}

describe("admin route inventory", () => {
  it("finds the admin API (guards against the capture silently matching nothing)", () => {
    expect(adminRoutes().length).toBeGreaterThan(60);
    expect(adminRoutes().map((r) => `${r.method} ${r.url}`)).toEqual(
      expect.arrayContaining(["GET /api/v1/admin/users", "PATCH /api/v1/admin/settings/:id", "POST /api/v1/admin/catalog-import/csv"]),
    );
  });

  it("every ADMIN_ONLY entry is a real route", () => {
    const known = new Set(adminRoutes().map((r) => `${r.method} ${r.url}`));
    for (const entry of ADMIN_ONLY) expect(known.has(entry)).toBe(true);
  });
});

describe("admin API authorisation matrix", () => {
  it("rejects a request without a token on every admin route (401)", async () => {
    const failures: string[] = [];
    for (const route of adminRoutes()) {
      const res = await call(route, null);
      if (res.statusCode !== 401) failures.push(`${route.method} ${route.url} -> ${res.statusCode}`);
    }
    expect(failures).toEqual([]);
  });

  it("rejects a CUSTOMER on every admin route (403)", async () => {
    const failures: string[] = [];
    for (const route of adminRoutes()) {
      const res = await call(route, "CUSTOMER");
      if (res.statusCode !== 403) failures.push(`${route.method} ${route.url} -> ${res.statusCode}`);
    }
    expect(failures).toEqual([]);
  });

  it("lets STAFF through on every admin route except the ADMIN-only ones", async () => {
    const failures: string[] = [];
    for (const route of adminRoutes()) {
      const key = `${route.method} ${route.url}`;
      const res = await call(route, "STAFF");
      const expected = ADMIN_ONLY.has(key) ? 403 : 200;
      if (res.statusCode !== expected) failures.push(`${key} -> ${res.statusCode} (expected ${expected})`);
    }
    expect(failures).toEqual([]);
  });

  it("lets ADMIN through on every admin route", async () => {
    const failures: string[] = [];
    for (const route of adminRoutes()) {
      const res = await call(route, "ADMIN");
      if (res.statusCode !== 200) failures.push(`${route.method} ${route.url} -> ${res.statusCode}`);
    }
    expect(failures).toEqual([]);
  });

  it("treats a suspended account as unauthenticated even with a valid token", async () => {
    mocks.findUnique.mockImplementation(async () => ({ role: "ADMIN", status: "SUSPENDED" }));
    const route = { method: "GET", url: "/api/v1/admin/users/" };
    const token = signAccessToken({ sub: UUID, role: "ADMIN", customerId: null, companyId: null } as never);
    const res = await app.inject({ method: "GET", url: route.url, headers: { authorization: `Bearer ${token}` }, remoteAddress: "10.9.9.9" });
    expect(res.statusCode).toBe(401);
  });
});
