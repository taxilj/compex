import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../lib/audit.js";
import { nextVendorRfqNumber } from "./vendor-rfq-number.js";

const VENDOR_RFQ_SELECT = {
  id: true,
  vendorRfqNumber: true,
  rfqId: true,
  vendorId: true,
  status: true,
  emailSentAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { id: true, name: true, contactEmail: true } },
  items: { select: { id: true, rfqItemId: true, quantity: true, notes: true } },
  quotes: {
    select: {
      id: true,
      rfqItemId: true,
      status: true,
      unitCost: true,
      currency: true,
      leadTimeDays: true,
      moq: true,
      notes: true,
    },
  },
} as const;

export async function adminVendorRfqsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const q = z.object({
      rfqId: z.string().uuid().optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);

    const where = q.rfqId ? { rfqId: q.rfqId } : {};
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.vendorRfq.findMany({ where, select: VENDOR_RFQ_SELECT, skip, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.vendorRfq.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const vrfq = await prisma.vendorRfq.findUnique({ where: { id }, select: VENDOR_RFQ_SELECT });
    if (!vrfq) throw Errors.notFound("VendorRfq");
    return reply.send(ok(vrfq));
  });

  app.post("/", async (req, reply) => {
    const body = z.object({
      rfqId: z.string().uuid(),
      vendorId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()).min(1),
      notes: z.string().max(2000).optional(),
    }).parse(req.body);

    const [rfq, vendor] = await Promise.all([
      prisma.rfq.findUnique({ where: { id: body.rfqId }, select: { id: true } }),
      prisma.vendor.findUnique({ where: { id: body.vendorId }, select: { id: true } }),
    ]);
    if (!rfq) throw Errors.notFound("RFQ");
    if (!vendor) throw Errors.notFound("Vendor");

    const rfqItems = await prisma.rfqItem.findMany({
      where: { id: { in: body.itemIds }, rfqId: body.rfqId },
    });
    if (rfqItems.length !== body.itemIds.length) {
      throw Errors.validation("One or more RFQ item IDs are invalid or don't belong to this RFQ");
    }

    const vendorRfqNumber = await nextVendorRfqNumber();

    const vrfq = await prisma.vendorRfq.create({
      data: {
        vendorRfqNumber,
        rfqId: body.rfqId,
        vendorId: body.vendorId,
        notes: body.notes,
        items: {
          create: rfqItems.map((item) => ({ rfqItemId: item.id, quantity: item.quantity })),
        },
      },
      select: VENDOR_RFQ_SELECT,
    });

    audit({
      userId: req.user!.id,
      action: "vendor_rfq.created",
      entityType: "vendor_rfq",
      entityId: vrfq.id,
      newValue: { vendorRfqNumber, vendorId: body.vendorId, rfqId: body.rfqId },
    });

    return reply.status(201).send(ok(vrfq));
  });

  // Record vendor quote (internal — never exposed to customers)
  app.post("/:id/quotes", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      rfqItemId: z.string().uuid(),
      unitCost: z.number().positive(),
      currency: z.string().length(3).default("USD"),
      leadTimeDays: z.number().int().positive().optional(),
      moq: z.number().int().positive().optional(),
      notes: z.string().max(2000).optional(),
    }).parse(req.body);

    const vrfq = await prisma.vendorRfq.findUnique({ where: { id }, select: { id: true } });
    if (!vrfq) throw Errors.notFound("VendorRfq");

    const item = await prisma.vendorRfqItem.findFirst({ where: { vendorRfqId: id, rfqItemId: body.rfqItemId } });
    if (!item) throw Errors.validation("rfqItemId is not part of this vendor RFQ");

    const quote = await prisma.$transaction(async (tx) => {
      const q = await tx.vendorQuote.create({
        data: {
          vendorRfqId: id,
          rfqItemId: body.rfqItemId,
          unitCost: new Decimal(body.unitCost),
          currency: body.currency,
          leadTimeDays: body.leadTimeDays,
          moq: body.moq,
          notes: body.notes,
        },
      });
      await tx.vendorRfq.update({ where: { id }, data: { status: "REPLIED" } });
      return q;
    });

    return reply.status(201).send(ok(quote));
  });
}
