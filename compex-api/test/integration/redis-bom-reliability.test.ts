import net from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import IORedis, { type RedisOptions } from "ioredis";
import { Queue, Worker } from "bullmq";
import {
  FAIL_FAST_REDIS_OPTIONS,
  WORKER_IDLE_OPTIONS,
  WORKER_REDIS_OPTIONS,
  pauseOnRedisError,
} from "../../src/lib/redis-options.js";

// Redis behaviour of the BOM queue against a DISPOSABLE Redis. Skipped unless
// REDIS_IT_URL points at a loopback Redis (e.g. docker-compose.qa.yml `redis`
// on a spare port). Never point it at a shared or production Redis: the test
// flushes the database it is given.
const REDIS_IT_URL = process.env.REDIS_IT_URL ?? "";
const redisHost = REDIS_IT_URL ? new URL(REDIS_IT_URL).hostname : "";
const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(redisHost);
const suite = REDIS_IT_URL && isLoopback ? describe : describe.skip;
const redisPort = REDIS_IT_URL ? Number(new URL(REDIS_IT_URL).port || 6379) : 0;

const QUEUE = "bom-processing-it";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs: number, what: string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(50);
  }
  throw new Error(`timed out waiting for ${what}`);
}

// A stand-in for "Redis provider whose command quota is used up": every command
// except the handshake is answered with the provider's quota error. In "pass"
// mode it forwards to the real disposable Redis, so recovery can be tested.
function startQuotaProxy() {
  let mode: "quota" | "pass" = "quota";
  let commands = 0;
  const sockets = new Set<net.Socket>();
  const server = net.createServer((client) => {
    sockets.add(client);
    client.on("close", () => sockets.delete(client));
    client.on("error", () => undefined);
    if (mode === "pass") {
      const upstream = net.connect(redisPort, "127.0.0.1");
      sockets.add(upstream);
      upstream.on("close", () => sockets.delete(upstream));
      upstream.on("error", () => client.destroy());
      client.pipe(upstream);
      upstream.pipe(client);
      return;
    }
    let pending = "";
    client.on("data", (chunk) => {
      pending += chunk.toString("latin1");
      for (;;) {
        const parsed = parseCommand(pending);
        if (!parsed) return;
        pending = pending.slice(parsed.consumed);
        commands += 1;
        if (parsed.name === "INFO") {
          const body = "redis_version:7.0.0\r\nloading:0\r\n";
          client.write(`$${body.length}\r\n${body}\r\n`);
        } else if (parsed.name === "PING") client.write("+PONG\r\n");
        else client.write("-ERR max requests limit exceeded. Limit: 500000, Usage: 500001\r\n");
      }
    });
  });
  return {
    listen: () => new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as net.AddressInfo).port))),
    setMode(next: "quota" | "pass") {
      mode = next;
      for (const socket of sockets) socket.destroy(); // clients reconnect and get the new mode
    },
    commands: () => commands,
    close: () => {
      for (const socket of sockets) socket.destroy();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function parseCommand(buffer: string): { name: string; consumed: number } | null {
  if (!buffer.startsWith("*")) return null;
  const lines = buffer.split("\r\n");
  const count = Number(lines[0]!.slice(1));
  let index = 1;
  let name = "";
  for (let arg = 0; arg < count; arg += 1) {
    const header = lines[index];
    const value = lines[index + 1];
    if (header === undefined || value === undefined || !header.startsWith("$")) return null;
    if (arg === 0) name = value.toUpperCase();
    index += 2;
  }
  const consumed = lines.slice(0, index).join("\r\n").length + 2;
  return consumed <= buffer.length ? { name, consumed } : null;
}

suite("BOM queue against a disposable Redis", () => {
  const closers: Array<() => Promise<unknown>> = [];
  let admin: IORedis;

  beforeAll(async () => {
    admin = new IORedis(REDIS_IT_URL);
    await admin.flushdb();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.allSettled(closers.splice(0).reverse().map((close) => close()));
    await admin.flushdb();
  });
  afterAll(async () => {
    await admin.quit();
  });

  function track<T extends { close: () => Promise<unknown> }>(thing: T): T {
    closers.push(() => thing.close());
    return thing;
  }

  // Clients handed to Queue/Worker are not closed by them; disconnect them so none keeps
  // reconnecting (and logging) after its stand-in server is gone.
  function conn(url: string, options: RedisOptions = {}): IORedis {
    const client = new IORedis(url, options);
    closers.push(async () => client.disconnect());
    return client;
  }

  const commandsProcessed = async () =>
    Number(/total_commands_processed:(\d+)/.exec(await admin.info("stats"))![1]);

  it("a repeated add with the same jobId queues one job, and two workers deliver it once", async () => {
    const queue = track(new Queue(QUEUE, { connection: conn(REDIS_IT_URL, FAIL_FAST_REDIS_OPTIONS) }));
    const options = { jobId: "bom-doc-1", removeOnFail: true, removeOnComplete: true };
    await queue.add("parse-bom", { documentId: "doc-1" }, options);
    await queue.add("parse-bom", { documentId: "doc-1" }, options);
    expect((await queue.getJobCounts("waiting")).waiting).toBe(1);

    const handled: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      track(new Worker(QUEUE, async (job) => { handled.push(job.id!); }, {
        connection: conn(REDIS_IT_URL, WORKER_REDIS_OPTIONS),
        ...WORKER_IDLE_OPTIONS,
      }));
    }
    await waitFor(() => handled.length >= 1, 5000, "the job to be handled");
    await sleep(500);
    expect(handled).toEqual(["bom-doc-1"]);
    // removeOnComplete frees the jobId, so recovery can add the same document again.
    await queue.add("parse-bom", { documentId: "doc-1" }, options);
    await waitFor(() => handled.length === 2, 5000, "the re-added job to be handled");
  });

  it("an idle worker with the production options costs almost no Redis commands", async () => {
    track(new Worker(QUEUE, async () => undefined, {
      connection: conn(REDIS_IT_URL, WORKER_REDIS_OPTIONS),
      ...WORKER_IDLE_OPTIONS,
    }));
    await sleep(1000); // let start-up commands settle
    const before = await commandsProcessed();
    await sleep(10_000);
    const idleCommands = (await commandsProcessed()) - before - 2; // minus this probe's own INFO calls
    // Measured: ~0 here versus 15 for BullMQ's defaults (5 s drain poll, 30 s stalled sweep).
    expect(idleCommands).toBeLessThanOrEqual(5);
  }, 20_000);

  it("a job whose worker died mid-run is redelivered to another worker", async () => {
    const queue = track(new Queue(QUEUE, { connection: conn(REDIS_IT_URL, FAIL_FAST_REDIS_OPTIONS) }));
    // Short lock and sweep so the test does not wait the production 5 minutes.
    const fast = { lockDuration: 1000, stalledInterval: 500, maxStalledCount: 1 };
    const crashed = new Worker(QUEUE, () => new Promise<void>(() => undefined), {
      connection: conn(REDIS_IT_URL, WORKER_REDIS_OPTIONS),
      ...fast,
    });
    await queue.add("parse-bom", { documentId: "doc-2" }, { jobId: "bom-doc-2", removeOnComplete: true });
    await waitFor(async () => (await queue.getJobCounts("active")).active === 1, 5000, "the job to start");
    await crashed.close(true); // abandon the job without completing or failing it

    const handled: string[] = [];
    track(new Worker(QUEUE, async (job) => { handled.push(job.id!); }, {
      connection: conn(REDIS_IT_URL, WORKER_REDIS_OPTIONS),
      ...fast,
    }));
    await waitFor(() => handled.length === 1, 15_000, "the stalled job to be redelivered");
    expect(handled).toEqual(["bom-doc-2"]);
  }, 30_000);

  describe("when the provider quota is exhausted", () => {
    it("enqueue fails fast and keeps the upload pending, and the probe is not repeated inside the cool-down", async () => {
      const proxy = startQuotaProxy();
      closers.push(() => proxy.close());
      const port = await proxy.listen();
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
      vi.resetModules();
      const service = await import("../../src/modules/documents/documents.service.js");
      closers.push(async () => {
        const queue = service.getBomQueue();
        const client = await queue.client;
        await queue.close();
        client.disconnect();
      });

      await expect(service.enqueueBomJob("doc-3", { documentId: "doc-3", leadId: "lead-3" })).rejects.toMatchObject({ statusCode: 503 });
      expect(await service.isBomQueueAvailable()).toBe(false);
      const seen = proxy.commands();
      for (let i = 0; i < 5; i += 1) expect(await service.isBomQueueAvailable()).toBe(false);
      expect(proxy.commands()).toBe(seen); // answered from the cached verdict: no new Redis command
    }, 20_000);

    it("capability is false under quota (no crash), then a real write probe recovers it once Redis accepts writes", async () => {
      const proxy = startQuotaProxy();
      closers.push(() => proxy.close());
      const port = await proxy.listen();
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      process.env.REDIS_URL = `redis://127.0.0.1:${port}`;
      vi.resetModules();
      const service = await import("../../src/modules/documents/documents.service.js");
      closers.push(async () => {
        const queue = service.getBomQueue();
        const client = await queue.client;
        await queue.close();
        client.disconnect();
      });

      expect(await service.isBomQueueAvailable()).toBe(false);
      const sent = proxy.commands();
      for (let i = 0; i < 50; i += 1) expect(await service.isBomQueueAvailable()).toBe(false);
      expect(proxy.commands()).toBe(sent); // held: 50 checks sent Redis nothing

      proxy.setMode("pass");
      // The ten-minute quota hold is cleared so the probe can be tried against the real Redis now.
      await waitFor(async () => {
        service.resetBomQueueHealth();
        return service.isBomQueueAvailable();
      }, 15_000, "the write probe to succeed against the real Redis");
      expect(await admin.get("compex:health:probe")).toBe("1"); // proof it was a real write
    }, 30_000);

    it("a worker stops hammering Redis, then resumes by itself and processes the pending job once Redis is back", async () => {
      const proxy = startQuotaProxy();
      closers.push(() => proxy.close());
      const port = await proxy.listen();
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const handled: string[] = [];
      const worker = track(new Worker(QUEUE, async (job) => { handled.push(job.id!); }, {
        connection: conn(`redis://127.0.0.1:${port}`, WORKER_REDIS_OPTIONS),
        ...WORKER_IDLE_OPTIONS,
        runRetryDelay: 500, // production waits 60 s between retries; shortened so the test finishes
      }));
      pauseOnRedisError(worker, "bom-worker-it", 2000);

      await sleep(4000);
      const sentDuringOutage = proxy.commands();
      expect(sentDuringOutage).toBeLessThan(60); // no busy loop while the quota is exhausted
      await sleep(1500);
      expect(proxy.commands() - sentDuringOutage).toBeLessThan(30);

      // Redis comes back; a job is added through the real server in the meantime.
      const queue = track(new Queue(QUEUE, { connection: conn(REDIS_IT_URL, FAIL_FAST_REDIS_OPTIONS) }));
      await queue.add("parse-bom", { documentId: "doc-4" }, { jobId: "bom-doc-4", removeOnComplete: true });
      proxy.setMode("pass");
      await waitFor(() => handled.length >= 1, 30_000, "the worker to recover and handle the job");
      expect(handled).toEqual(["bom-doc-4"]);
    }, 60_000);
  });
});
