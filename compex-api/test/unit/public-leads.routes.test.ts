import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  createWebsiteEnquiry: vi.fn(),
  WebsiteEnquirySchema: { parse: (body: unknown) => body },
}));

const capabilityMocks = vi.hoisted(() => ({
  isDurableStorageAvailable: vi.fn(),
  isBomQueueAvailable: vi.fn(),
}));

vi.mock("../../src/modules/leads/website-enquiries.service.js", () => routeMocks);
vi.mock("../../src/modules/documents/documents.service.js", () => capabilityMocks);
vi.mock("../../src/modules/leads/lead-bom-upload.js", () => ({ leadBomUploadHandler: vi.fn(), getLeadBomStatus: vi.fn() }));

import { publicLeadsRoutes } from "../../src/modules/leads/public-leads.routes.js";

describe("public leads route safeguards", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    vi.clearAllMocks();
  });

  it("rate limits repeated public submissions", async () => {
    routeMocks.createWebsiteEnquiry.mockResolvedValue({
      lead: { referenceNumber: "ENQ-2026-000001", source: "CONTACT" },
      duplicate: false,
    });
    const app = Fastify();
    apps.push(app);
    await app.register(rateLimit);
    await app.register(publicLeadsRoutes, { prefix: "/leads" });

    const body = { source: "CONTACT", contactName: "Asha", contactEmail: "asha@example.com", companyName: "Example", message: "Help" };
    for (let count = 0; count < 5; count += 1) {
      expect((await app.inject({ method: "POST", url: "/leads", payload: body })).statusCode).toBe(201);
    }
    expect((await app.inject({ method: "POST", url: "/leads", payload: body })).statusCode).toBe(429);
  });

  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
    [false, false, false],
  ])("bom-capability: storage=%s queue=%s -> available=%s", async (storage, queue, expected) => {
    capabilityMocks.isDurableStorageAvailable.mockResolvedValue(storage);
    capabilityMocks.isBomQueueAvailable.mockResolvedValue(queue);
    const app = Fastify();
    apps.push(app);
    await app.register(rateLimit);
    await app.register(publicLeadsRoutes, { prefix: "/leads" });

    const response = await app.inject({ method: "GET", url: "/leads/bom-capability" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ available: expected });
  });
});
