import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { ok, paginated } from "../../lib/response.js";

const PAGE = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(50).default(20) });

async function customerIdForUser(userId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) throw Errors.forbidden();
  return customer.id;
}

const orderInclude = {
  quotation: { select: { quotationNumber: true } },
  items: { orderBy: { lineNumber: "asc" as const } },
} as const;

export async function customerOrdersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("CUSTOMER"));

  app.get("/", async (req, reply) => {
    const customerId = await customerIdForUser(req.user!.id);
    const q = PAGE.extend({ status: z.enum(["DRAFT", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional() }).parse(req.query);
    const where = { customerId, ...(q.status ? { status: q.status } : {}) };
    const [data, total] = await prisma.$transaction([
      prisma.salesOrder.findMany({ where, include: orderInclude, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.salesOrder.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const customerId = await customerIdForUser(req.user!.id);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const order = await prisma.salesOrder.findFirst({ where: { id, customerId }, include: orderInclude });
    if (!order) throw Errors.notFound("SalesOrder");
    return reply.send(ok(order));
  });
}

export async function customerShipmentsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("CUSTOMER"));

  app.get("/", async (req, reply) => {
    const customerId = await customerIdForUser(req.user!.id);
    const q = PAGE.extend({ status: z.enum(["PROCESSING", "IN_TRANSIT", "CUSTOMS", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]).optional() }).parse(req.query);
    const where = { salesOrder: { customerId }, ...(q.status ? { status: q.status } : {}) };
    const [data, total] = await prisma.$transaction([
      prisma.shipment.findMany({ where, include: { salesOrder: { select: { orderNumber: true } } }, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.shipment.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const customerId = await customerIdForUser(req.user!.id);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const shipment = await prisma.shipment.findFirst({ where: { id, salesOrder: { customerId } }, include: { salesOrder: { select: { orderNumber: true } } } });
    if (!shipment) throw Errors.notFound("Shipment");
    return reply.send(ok(shipment));
  });
}

export async function customerInvoicesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("CUSTOMER"));

  app.get("/", async (req, reply) => {
    const customerId = await customerIdForUser(req.user!.id);
    const q = PAGE.extend({ status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional() }).parse(req.query);
    const where = { customerId, ...(q.status ? { status: q.status } : {}) };
    const [data, total] = await prisma.$transaction([
      prisma.invoice.findMany({ where, include: { salesOrder: { select: { orderNumber: true } }, items: { orderBy: { lineNumber: "asc" } } }, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.invoice.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const customerId = await customerIdForUser(req.user!.id);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const invoice = await prisma.invoice.findFirst({ where: { id, customerId }, include: { salesOrder: { select: { orderNumber: true } }, items: { orderBy: { lineNumber: "asc" } } } });
    if (!invoice) throw Errors.notFound("Invoice");
    return reply.send(ok(invoice));
  });
}
