import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../lib/response.js";
import { createWebsiteEnquiry, WebsiteEnquirySchema } from "./website-enquiries.service.js";

const IdempotencyKeySchema = z.string().uuid().optional();

export async function publicLeadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { bodyLimit: 32 * 1024, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = WebsiteEnquirySchema.parse(req.body);
    const rawIdempotencyKey = req.headers["idempotency-key"];
    const idempotencyKey = IdempotencyKeySchema.parse(
      typeof rawIdempotencyKey === "string" ? rawIdempotencyKey : undefined,
    );
    const result = await createWebsiteEnquiry(body, idempotencyKey, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    if (result.ignored) return reply.status(202).send(ok({ accepted: true }));
    return reply.status(result.duplicate ? 200 : 201).send(ok({
      referenceNumber: result.lead.referenceNumber,
      source: result.lead.source,
    }));
  });
}
