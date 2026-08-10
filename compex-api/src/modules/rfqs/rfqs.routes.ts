import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Errors } from "../../lib/errors.js";
import { ok, paginated } from "../../lib/response.js";
import * as rfqsService from "./rfqs.service.js";
import {
  CreateRfqSchema,
  UpdateRfqSchema,
  CreateRfqItemSchema,
  UpdateRfqItemSchema,
  RfqListQuerySchema,
} from "./rfqs.schema.js";
import { bomUploadHandler } from "../documents/bom-upload.js";
import { z } from "zod";

export async function rfqsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("CUSTOMER"));

  app.post("/", async (req, reply) => {
    const { customerId, id: userId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const body = CreateRfqSchema.parse(req.body);
    const rfq = await rfqsService.createRfq(customerId, userId, body);
    return reply.status(201).send(ok(rfq));
  });

  app.get("/", async (req, reply) => {
    const { customerId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const query = RfqListQuerySchema.parse(req.query);
    const result = await rfqsService.listRfqs(customerId, query);
    return reply.send(paginated(result.data, result.total, result.page, result.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { customerId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const rfq = await rfqsService.getRfq(id, customerId);
    return reply.send(ok(rfq));
  });

  app.patch("/:id", async (req, reply) => {
    const { customerId, id: userId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = UpdateRfqSchema.parse(req.body);
    const rfq = await rfqsService.updateRfq(id, customerId, userId, body);
    return reply.send(ok(rfq));
  });

  app.post("/:id/submit", async (req, reply) => {
    const { customerId, id: userId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const rfq = await rfqsService.submitRfq(id, customerId, userId);
    return reply.send(ok(rfq));
  });

  app.post("/:id/items", async (req, reply) => {
    const { customerId, id: userId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = CreateRfqItemSchema.parse(req.body);
    const item = await rfqsService.addItem(id, customerId, userId, body);
    return reply.status(201).send(ok(item));
  });

  app.patch("/:id/items/:itemId", async (req, reply) => {
    const { customerId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const { id, itemId } = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(req.params);
    const body = UpdateRfqItemSchema.parse(req.body);
    const item = await rfqsService.updateItem(id, itemId, customerId, body);
    return reply.send(ok(item));
  });

  app.delete("/:id/items/:itemId", async (req, reply) => {
    const { customerId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const { id, itemId } = z.object({ id: z.string().uuid(), itemId: z.string().uuid() }).parse(req.params);
    await rfqsService.deleteItem(id, itemId, customerId);
    return reply.status(204).send();
  });

  app.post("/:id/bom", { preHandler: [] }, async (req, reply) => {
    const { customerId, id: userId } = req.user!;
    if (!customerId) throw Errors.forbidden();
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const result = await bomUploadHandler(req, id, customerId, userId);
    return reply.status(202).send(ok(result));
  });
}