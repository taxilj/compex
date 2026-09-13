import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../lib/response.js";
import { createWebsiteEnquiry, WebsiteEnquirySchema } from "./website-enquiries.service.js";
import { isDurableStorageAvailable } from "../documents/documents.service.js";
import { leadBomUploadHandler, getLeadBomStatus } from "./lead-bom-upload.js";

const IdempotencyKeySchema = z.string().uuid().optional();
const LeadIdParamSchema = z.object({ leadId: z.string().uuid() });

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
      id: result.lead.id,
      referenceNumber: result.lead.referenceNumber,
      source: result.lead.source,
    }));
  });

  // Real, non-hardcoded readiness signal for the public BOM upload UI. Never
  // a destructive test -- see documents.service.ts#isDurableStorageAvailable.
  app.get("/bom-capability", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (_req, reply) => {
    const available = await isDurableStorageAvailable();
    return reply.send(ok({ available }));
  });

  // :leadId is the lead's internal UUID (returned once, at creation, in the
  // POST / response above) -- never the human-readable referenceNumber,
  // which is a predictable sequential counter and unsuitable as an
  // authorization token for attaching or reading a document.
  app.post("/:leadId/bom", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { leadId } = LeadIdParamSchema.parse(req.params);
    const result = await leadBomUploadHandler(req, leadId);
    return reply.status(202).send(ok(result));
  });

  app.get("/:leadId/bom", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { leadId } = LeadIdParamSchema.parse(req.params);
    const result = await getLeadBomStatus(leadId);
    return reply.send(ok(result));
  });
}
