import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../lib/audit.js";
import { cancelFollowUps } from "../../jobs/follow-up-scheduler.js";

// SECURITY: Only customer-visible fields — never expose vendor cost, margin, internal data
const CUSTOMER_QUOTE_SELECT = {
  id: true,
  quotationNumber: true,
  status: true,
  currency: true,
  subtotal: true,
  tax: true,
  total: true,
  validUntil: true,
  deliveryTerms: true,
  paymentTerms: true,
  notes: true,
  sentAt: true,
  viewedAt: true,
  respondedAt: true,
  createdAt: true,
  rfq: { select: { id: true, rfqNumber: true } },
  items: {
    select: {
      id: true,
      lineNumber: true,
      mpn: true,
      description: true,
      quantity: true,
      unitPrice: true,
      taxRate: true,
      taxAmount: true,
      lineTotal: true,
    },
    orderBy: { lineNumber: "asc" as const },
  },
} as const;

async function getCustomerIdForUser(userId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) throw Errors.forbidden();
  return customer.id;
}

export async function quotesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("CUSTOMER"));

  app.get("/", async (req, reply) => {
    const customerId = await getCustomerIdForUser(req.user!.id);
    const q = z.object({
      status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(50).default(10),
    }).parse(req.query);

    const where = {
      customerId,
      ...(q.status ? { status: q.status } : { NOT: { status: "DRAFT" as const } }),
    };
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.quotation.findMany({ where, select: CUSTOMER_QUOTE_SELECT, skip, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.quotation.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const customerId = await getCustomerIdForUser(req.user!.id);

    const ownership = await prisma.quotation.findUnique({ where: { id }, select: { customerId: true, status: true } });
    if (!ownership) throw Errors.notFound("Quotation");
    if (ownership.customerId !== customerId) throw Errors.forbidden();

    if (ownership.status === "SENT") {
      await prisma.quotation.update({ where: { id }, data: { status: "VIEWED", viewedAt: new Date() } });
    }

    const q = await prisma.quotation.findUnique({ where: { id }, select: CUSTOMER_QUOTE_SELECT });
    return reply.send(ok(q));
  });

  app.post("/:id/accept", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const customerId = await getCustomerIdForUser(req.user!.id);

    const q = await prisma.quotation.findUnique({ where: { id }, select: { id: true, status: true, customerId: true, rfqId: true } });
    if (!q) throw Errors.notFound("Quotation");
    if (q.customerId !== customerId) throw Errors.forbidden();
    if (q.status !== "SENT" && q.status !== "VIEWED") {
      throw Errors.unprocessable("Only SENT or VIEWED quotations can be accepted");
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
      select: CUSTOMER_QUOTE_SELECT,
    });

    cancelFollowUps(q.rfqId).catch((err) => console.error("[FOLLOWUP] Cancel after accept failed:", err));
    audit({ userId: req.user!.id, action: "quotation.accepted", entityType: "quotation", entityId: id });
    return reply.send(ok(updated));
  });

  app.post("/:id/reject", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const customerId = await getCustomerIdForUser(req.user!.id);
    const body = z.object({ reason: z.string().max(500).optional() }).parse(req.body ?? {});

    const q = await prisma.quotation.findUnique({ where: { id }, select: { id: true, status: true, customerId: true, rfqId: true } });
    if (!q) throw Errors.notFound("Quotation");
    if (q.customerId !== customerId) throw Errors.forbidden();
    if (q.status !== "SENT" && q.status !== "VIEWED") {
      throw Errors.unprocessable("Only SENT or VIEWED quotations can be rejected");
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: {
        status: "REJECTED",
        respondedAt: new Date(),
      },
      select: CUSTOMER_QUOTE_SELECT,
    });

    cancelFollowUps(q.rfqId).catch((err) => console.error("[FOLLOWUP] Cancel after reject failed:", err));
    audit({ userId: req.user!.id, action: "quotation.rejected", entityType: "quotation", entityId: id });
    return reply.send(ok(updated));
  });
}
