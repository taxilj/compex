import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  createWebsiteEnquiry: vi.fn(),
  WebsiteEnquirySchema: { parse: (body: unknown) => body },
}));

vi.mock("../../src/modules/leads/website-enquiries.service.js", () => routeMocks);

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

});
