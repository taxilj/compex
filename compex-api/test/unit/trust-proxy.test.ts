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
    const one = trustProxySetting(1);
    const two = trustProxySetting(2);
    expect(typeof one).toBe("function");
    expect(one!(RENDER_PROXY, 0)).toBe(true);
    expect(one!(RENDER_PROXY, 1)).toBe(false);
    expect(two!(RENDER_PROXY, 1)).toBe(true);
    expect(two!(RENDER_PROXY, 2)).toBe(false);
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

// Render documents "Cloudflare -> Render load balancer -> service" but not the hop
// count. Assumed chain used below (verify with GET /admin/settings/client-ip before
// trusting it): the app's TCP peer is the private Render balancer, and
// X-Forwarded-For arrives as "<client>, <cloudflare edge>" because each proxy
// appends the address it received the request from. A caller-supplied
// X-Forwarded-For therefore ends up to the LEFT of the real client.
describe("assumed Render chain: Cloudflare edge -> Render balancer -> app", () => {
  const apps: { close: () => Promise<unknown> }[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  const CLOUDFLARE_EDGE = "172.69.10.20";
  const chain = (client: string, spoofed?: string) =>
    `${spoofed ? `${spoofed}, ` : ""}${client}, ${CLOUDFLARE_EDGE}`;

  it("with 2 trusted hops, two visitors get different IPs and separate rate-limit buckets", async () => {
    const app = await buildProbe(2);
    apps.push(app);
    expect((await hit(app, chain("198.51.100.1"))).json().ip).toBe("198.51.100.1");
    await hit(app, chain("198.51.100.1"));
    expect((await hit(app, chain("198.51.100.1"))).statusCode).toBe(429);
    expect((await hit(app, chain("198.51.100.2"))).statusCode).toBe(200);
  });

  it("with 2 trusted hops, a caller-supplied X-Forwarded-For cannot change the client IP or dodge the limit", async () => {
    const app = await buildProbe(2);
    apps.push(app);
    for (const spoof of ["1.1.1.1", "2.2.2.2"]) {
      expect((await hit(app, chain("198.51.100.1", spoof))).json().ip).toBe("198.51.100.1");
    }
    expect((await hit(app, chain("198.51.100.1", "3.3.3.3"))).statusCode).toBe(429);
  });

  it("with 1 trusted hop the Cloudflare edge is mistaken for the client (a wrong count shares one bucket across visitors)", async () => {
    const app = await buildProbe(1);
    apps.push(app);
    expect((await hit(app, chain("198.51.100.1"))).json().ip).toBe(CLOUDFLARE_EDGE);
    await hit(app, chain("198.51.100.2"));
    expect((await hit(app, chain("198.51.100.3"))).statusCode).toBe(429);
  });

  it("with 3 trusted hops a caller can pick its own IP (a count above the real chain is unsafe)", async () => {
    const app = await buildProbe(3);
    apps.push(app);
    expect((await hit(app, chain("198.51.100.1", "9.9.9.9"))).json().ip).toBe("9.9.9.9");
  });
});

// The production limiter keys on the authenticated user id when there is one and
// the client IP otherwise (see plugins/index.ts). Caveat that matters for F3:
// @fastify/rate-limit runs in onRequest, and the API's `authenticate` runs later
// in preHandler, so in production req.user is not yet set when the key is built.
// The tests below set the user in onRequest to show the intended behaviour; the
// last one documents what the real hook order does.
describe("rate-limit keys with authenticated users", () => {
  const apps: { close: () => Promise<unknown> }[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildAuthProbe(hops: number) {
    const app = Fastify({ trustProxy: trustProxySetting(hops) });
    app.decorateRequest("user", undefined);
    app.addHook("onRequest", async (req) => {
      const id = req.headers["x-test-user"];
      if (typeof id === "string") (req as unknown as { user?: { id: string } }).user = { id };
    });
    await app.register(rateLimit, {
      max: 2,
      timeWindow: "1 minute",
      keyGenerator: (req) => (req as unknown as { user?: { id: string } }).user?.id ?? req.ip,
    });
    app.get("/ip", async (req) => ({ ip: req.ip }));
    return app;
  }

  const call = (app: Awaited<ReturnType<typeof buildAuthProbe>>, headers: Record<string, string>) =>
    app.inject({ method: "GET", url: "/ip", remoteAddress: RENDER_PROXY, headers });

  it("two signed-in users behind the same proxy IP get separate buckets even with 0 trusted hops", async () => {
    const app = await buildAuthProbe(0);
    apps.push(app);
    await call(app, { "x-test-user": "u1" });
    await call(app, { "x-test-user": "u1" });
    expect((await call(app, { "x-test-user": "u1" })).statusCode).toBe(429);
    expect((await call(app, { "x-test-user": "u2" })).statusCode).toBe(200);
  });

  it("one user is limited as a single bucket regardless of which client IP they appear from", async () => {
    const app = await buildAuthProbe(1);
    apps.push(app);
    await call(app, { "x-test-user": "u1", "x-forwarded-for": "198.51.100.1" });
    await call(app, { "x-test-user": "u1", "x-forwarded-for": "198.51.100.2" });
    expect((await call(app, { "x-test-user": "u1", "x-forwarded-for": "198.51.100.3" })).statusCode).toBe(429);
  });

  it("anonymous visitors fall back to per-IP buckets when the proxy chain is trusted", async () => {
    const app = await buildAuthProbe(1);
    apps.push(app);
    await call(app, { "x-forwarded-for": "198.51.100.1" });
    await call(app, { "x-forwarded-for": "198.51.100.1" });
    expect((await call(app, { "x-forwarded-for": "198.51.100.1" })).statusCode).toBe(429);
    expect((await call(app, { "x-forwarded-for": "198.51.100.2" })).statusCode).toBe(200);
  });

  it("real hook order: authenticating in preHandler means the limiter still keys on IP (users behind one proxy IP share a bucket)", async () => {
    const app = Fastify({ trustProxy: trustProxySetting(0) });
    app.decorateRequest("user", undefined);
    app.addHook("preHandler", async (req) => {
      (req as unknown as { user?: { id: string } }).user = { id: String(req.headers["x-test-user"]) };
    });
    await app.register(rateLimit, {
      max: 2,
      timeWindow: "1 minute",
      keyGenerator: (req) => (req as unknown as { user?: { id: string } }).user?.id ?? req.ip,
    });
    app.get("/ip", async (req) => ({ ip: req.ip }));
    apps.push(app);
    await call(app, { "x-test-user": "u1" });
    await call(app, { "x-test-user": "u2" });
    expect((await call(app, { "x-test-user": "u3" })).statusCode).toBe(429);
  });
});
