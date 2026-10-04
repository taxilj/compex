import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it } from "vitest";
import { trustProxySetting } from "../../src/lib/trust-proxy.js";

const RENDER_PROXY = "10.0.0.5";

async function buildProbe(hops: number) {
  const app = Fastify({ trustProxy: trustProxySetting(hops) });
  await app.register(rateLimit, { max: 2, timeWindow: "1 minute", keyGenerator: (req) => req.ip });
  app.get("/ip", async (req) => ({ ip: req.ip }));
  return app;
}

function hit(app: Awaited<ReturnType<typeof buildProbe>>, forwardedFor?: string) {
  return app.inject({
    method: "GET",
    url: "/ip",
    remoteAddress: RENDER_PROXY,
    headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
  });
}

describe("trust proxy configuration", () => {
  const apps: Awaited<ReturnType<typeof buildProbe>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("maps 0 hops to 'trust nothing' and n hops to exactly n", () => {
    expect(trustProxySetting(0)).toBe(false);
    expect(trustProxySetting(1)).toBe(1);
    expect(trustProxySetting(2)).toBe(2);
  });

  it("with 0 hops, a client-supplied X-Forwarded-For is ignored entirely", async () => {
    const app = await buildProbe(0);
    apps.push(app);
    expect((await hit(app, "203.0.113.9")).json().ip).toBe(RENDER_PROXY);
  });

  it("with 0 hops behind a proxy, every visitor shares one rate-limit bucket (the current production problem)", async () => {
    const app = await buildProbe(0);
    apps.push(app);
    await hit(app, "198.51.100.1");
    await hit(app, "198.51.100.2");
    expect((await hit(app, "198.51.100.3")).statusCode).toBe(429);
  });

  it("with 1 hop, the address appended by the trusted proxy is the client and visitors get separate buckets", async () => {
    const app = await buildProbe(1);
    apps.push(app);
    expect((await hit(app, "198.51.100.1")).json().ip).toBe("198.51.100.1");
    await hit(app, "198.51.100.1");
    expect((await hit(app, "198.51.100.1")).statusCode).toBe(429);
    expect((await hit(app, "198.51.100.2")).statusCode).toBe(200);
  });

  it("with 1 hop, a spoofed left-most X-Forwarded-For entry cannot change the client IP", async () => {
    const app = await buildProbe(1);
    apps.push(app);
    // Client sent "X-Forwarded-For: 1.2.3.4"; the trusted proxy appended the real peer.
    expect((await hit(app, "1.2.3.4, 198.51.100.7")).json().ip).toBe("198.51.100.7");
  });

  it("a hop count larger than the real chain WOULD let a direct client spoof its IP (why it must be verified first)", async () => {
    const app = await buildProbe(2);
    apps.push(app);
    expect((await hit(app, "1.2.3.4, 198.51.100.7")).json().ip).toBe("1.2.3.4");
  });
});
