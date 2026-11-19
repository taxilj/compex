import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

// Defaults only when the environment does not already provide them, so the real
// app config can be imported without any real service.
vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/health_test";
  process.env.REDIS_URL ??= "redis://127.0.0.1:1";
  process.env.JWT_SECRET ??= "health-test-secret-health-test-secret-01";
  process.env.JWT_REFRESH_SECRET ??= "health-test-secret-health-test-secret-02";
});

// Every dependency /health must NOT touch is replaced with something that both
// fails loudly (simulating an outage) and records that it was called.
const deps = vi.hoisted(() => ({ prisma: 0, redis: 0, queue: 0 }));

vi.mock("../../src/lib/prisma.js", () => {
  const down = () => {
    deps.prisma++;
    throw new Error("database unavailable");
  };
  const model = new Proxy({}, { get: () => down });
  const prisma = new Proxy({}, { get: (_t, prop) => (prop === "then" ? undefined : prop.toString().startsWith("$") ? down : model) });
  return { prisma };
});

vi.mock("ioredis", () => {
  class DownRedis {
    constructor() {
      return new Proxy(this, {
        get: (_t, prop) => {
          if (prop === "on" || prop === "once" || prop === "off" || prop === "removeListener") return () => undefined;
          if (prop === "then") return undefined;
          return () => {
            deps.redis++;
            return Promise.reject(new Error("redis unavailable"));
          };
        },
      });
    }
  }
  return { default: DownRedis, Redis: DownRedis };
});

vi.mock("bullmq", () => {
  const touch = () => {
    deps.queue++;
    throw new Error("queue unavailable");
  };
  class Queue { constructor() { touch(); } }
  class Worker { constructor() { touch(); } }
  return { Queue, Worker, QueueEvents: Queue };
});

describe("GET /health (real app, dependencies down)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildApp } = await import("../../src/app.js");
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    deps.prisma = 0;
    deps.redis = 0;
    deps.queue = 0;
  });

  it("returns HTTP 200", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });

  it("sends restrictive API security headers on successful and error responses", async () => {
    for (const url of ["/health", "/api/v1/admin/users"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
      expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    }
  });

  it("returns JSON exactly { status: 'ok' }", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("still returns 200 when Redis is unavailable, without calling Redis or the catalogue cache", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    expect(deps.redis).toBe(0);
  });

  it("still returns 200 when the database is unavailable, without calling Prisma", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    expect(deps.prisma).toBe(0);
  });

  it("does not touch the queue layer and does not write anything", async () => {
    await app.inject({ method: "GET", url: "/health" });
    await app.inject({ method: "HEAD", url: "/health" });
    expect(deps.queue).toBe(0);
    expect(deps.redis).toBe(0);
    expect(deps.prisma).toBe(0);
  });

  it("is registered exactly once", () => {
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes.match(/\/health \(GET/g)?.length ?? 0).toBe(1);
  });
});
