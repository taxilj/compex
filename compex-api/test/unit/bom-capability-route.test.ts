import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real capability route and the real documents.service (probe, health memory) against a
// Redis client that fails like the production provider. Only the edges are faked.
const mocks = vi.hoisted(() => ({ set: vi.fn(), headBucket: vi.fn() }));

vi.mock("../../src/config/env.js", () => ({ env: { REDIS_URL: "redis://qa.invalid:6379", STORAGE_PROVIDER: "s3" } }));
vi.mock("ioredis", () => ({ default: vi.fn() }));
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(), on: vi.fn(), client: Promise.resolve({ set: mocks.set }) })),
}));
vi.mock("../../src/lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../../src/lib/storage/index.js", () => ({
  LocalStorageProvider: vi.fn(),
  S3StorageProvider: vi.fn().mockImplementation(() => ({ headBucket: mocks.headBucket })),
}));
vi.mock("../../src/modules/leads/website-enquiries.service.js", () => ({ createWebsiteEnquiry: vi.fn(), WebsiteEnquirySchema: { parse: (b: unknown) => b } }));
vi.mock("../../src/modules/leads/lead-bom-upload.js", () => ({ leadBomUploadHandler: vi.fn(), getLeadBomStatus: vi.fn() }));

import { publicLeadsRoutes } from "../../src/modules/leads/public-leads.routes.js";
import { resetBomQueueHealth } from "../../src/modules/documents/documents.service.js";
import { QUOTA_HOLD_MS } from "../../src/lib/redis-health.js";

async function buildApp() {
  const app = Fastify();
  await app.register(publicLeadsRoutes, { prefix: "/leads" });
  app.get("/health", async () => ({ status: "ok" })); // same static shape as src/app.ts
  return app;
}

describe("GET /leads/bom-capability under Redis failure", () => {
  const apps: ReturnType<typeof Fastify>[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetBomQueueHealth();
    mocks.headBucket.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    vi.useRealTimers();
  });

  const capability = async (app: Awaited<ReturnType<typeof buildApp>>) => {
    const res = await app.inject({ method: "GET", url: "/leads/bom-capability" });
    return { status: res.statusCode, available: res.json().data?.available };
  };

  it("reports available while Redis accepts writes", async () => {
    mocks.set.mockResolvedValue("OK");
    const app = await buildApp();
    apps.push(app);
    expect(await capability(app)).toEqual({ status: 200, available: true });
  });

  it("reports unavailable (HTTP 200, no crash) when Redis rejects writes for quota, and the API stays alive", async () => {
    mocks.set.mockRejectedValue(new Error("ERR max requests limit exceeded. Limit: 500000, Usage: 500002"));
    const app = await buildApp();
    apps.push(app);
    expect(await capability(app)).toEqual({ status: 200, available: false });
    expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok" });
  });

  it("reports unavailable on a connection failure, and keeps answering /health", async () => {
    mocks.set.mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:6379"), { code: "ECONNREFUSED" }));
    const app = await buildApp();
    apps.push(app);
    expect(await capability(app)).toEqual({ status: 200, available: false });
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });

  it("recovers by itself: still unavailable inside the hold, available again after it once Redis writes succeed", async () => {
    mocks.set.mockRejectedValueOnce(new Error("ERR max requests limit exceeded")).mockResolvedValue("OK");
    const app = await buildApp();
    apps.push(app);
    expect((await capability(app)).available).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await capability(app)).available).toBe(false); // quota hold is longer than a minute
    expect(mocks.set).toHaveBeenCalledTimes(1); // and nothing was sent to Redis meanwhile
    await vi.advanceTimersByTimeAsync(QUOTA_HOLD_MS);
    expect((await capability(app)).available).toBe(true);
  });
});
