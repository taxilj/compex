import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), transaction: vi.fn(), cache: vi.fn() }));
vi.mock("../../src/lib/prisma.js", () => ({ prisma: { manufacturer: { findMany: mocks.findMany, count: mocks.count }, $transaction: mocks.transaction } }));
vi.mock("../../src/modules/catalog/catalog-cache.js", () => ({ PUBLIC_CACHE_CONTROL: "public, s-maxage=30, stale-while-revalidate=120", catalogKey: (_prefix: string, query: unknown) => JSON.stringify(query), cachedCatalog: mocks.cache }));
import { manufacturersRoutes } from "../../src/modules/catalog/manufacturers.routes.js";
const apps: ReturnType<typeof Fastify>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([{ id: "last", name: "Last Manufacturer", slug: "last", _count: { products: 1 }, source: "PRIVATE", remarks: "private" }]);
  mocks.count.mockResolvedValue(3682);
  mocks.transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations));
  mocks.cache.mockImplementation((_key: string, load: () => Promise<unknown>) => load());
});
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
async function app() {
  const instance = Fastify(); apps.push(instance);
  instance.setErrorHandler((error, _request, reply) => reply.status(error instanceof ZodError ? 400 : 500).send({ success: false }));
  await instance.register(manufacturersRoutes, { prefix: "/manufacturers" });
  return instance;
}
describe("public manufacturer bounded pagination", () => {
  it("keeps the 100-row cap, offset, total and deterministic name ordering", async () => {
    const response = await (await app()).inject("/manufacturers?page=37&limit=100");
    expect(response.statusCode).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 3600, take: 100, orderBy: [{ name: "asc" }, { id: "asc" }] }));
    expect(response.json().meta).toEqual({ total: 3682, page: 37, limit: 100 });
    expect(response.json().data[0]).not.toHaveProperty("source");
    expect(response.json().data[0]).not.toHaveProperty("remarks");
    expect(response.headers["cache-control"]).toContain("s-maxage=30");
  });
  it("searches and counts the entire catalogue with the same filter, including the cache key", async () => {
    const response = await (await app()).inject("/manufacturers?page=1&limit=100&q=%20Last%20Manufacturer%20");
    const where = { name: { contains: "Last Manufacturer", mode: "insensitive" } };
    expect(response.statusCode).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 0, take: 100 }));
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(JSON.parse(mocks.cache.mock.calls[0][0])).toMatchObject({ q: "Last Manufacturer", page: 1, limit: 100 });
  });
  it.each(["limit=101", "limit=0", "page=0", `q=${"x".repeat(101)}`])("rejects invalid unbounded query %s", async query => {
    const response = await (await app()).inject(`/manufacturers?${query}`);
    expect(response.statusCode).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("does not turn a database failure into a successful empty page", async () => {
    mocks.findMany.mockRejectedValueOnce(new Error("query failed"));
    const response = await (await app()).inject("/manufacturers?page=1&limit=100");
    expect(response.statusCode).toBe(500);
    expect(response.json().success).toBe(false);
  });
});
