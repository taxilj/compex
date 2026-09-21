import type { FastifyInstance } from "fastify";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { ok, paginated } from "../../lib/response.js";
import { auditInTx } from "../../lib/audit.js";

const PAGE = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const salesOrderInclude = {
  customer: { select: { id: true, accountNumber: true, company: { select: { name: true } } } },
  quotation: { select: { id: true, quotationNumber: true } },
  items: { orderBy: { lineNumber: "asc" as const } },
} as const;

const purchaseOrderInclude = {
  vendor: { select: { id: true, name: true, contactEmail: true } },
  salesOrder: { select: { id: true, orderNumber: true, customer: { select: { company: { select: { name: true } } } } } },
  items: { orderBy: { lineNumber: "asc" as const } },
} as const;

const shipmentSelect = {
  id: true,
  shipmentNumber: true,
  salesOrderId: true,
  purchaseOrderId: true,
  status: true,
  trackingNumber: true,
  carrier: true,
  origin: true,
  destination: true,
  eta: true,
  deliveredAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  salesOrder: { select: { orderNumber: true, customerId: true } },
} as const;

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  salesOrderId: true,
  customerId: true,
  status: true,
  currency: true,
  subtotal: true,
  tax: true,
  total: true,
  dueDate: true,
  issuedAt: true,
  paidAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  salesOrder: { select: { orderNumber: true } },
  customer: { select: { company: { select: { name: true } } } },
  items: { orderBy: { lineNumber: "asc" as const } },
} as const;

const requireAdmin = async (app: FastifyInstance) => {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));
};

export async function adminOrdersRoutes(app: FastifyInstance): Promise<void> {
  await requireAdmin(app);

  app.get("/", async (req, reply) => {
    const q = PAGE.extend({ status: z.enum(["DRAFT", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional() }).parse(req.query);
    const where = q.status ? { status: q.status } : {};
    const [data, total] = await prisma.$transaction([
      prisma.salesOrder.findMany({ where, include: salesOrderInclude, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.salesOrder.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const order = await prisma.salesOrder.findUnique({ where: { id }, include: salesOrderInclude });
    if (!order) throw Errors.notFound("SalesOrder");
    return reply.send(ok(order));
  });
}

const PurchaseItemBody = z.object({
  salesOrderItemId: z.string().uuid(),
  vendorQuoteId: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  unitCost: z.number().min(0),
});

export async function adminPurchaseOrdersRoutes(app: FastifyInstance): Promise<void> {
  await requireAdmin(app);

  app.get("/", async (req, reply) => {
    const q = PAGE.extend({ status: z.enum(["DRAFT", "SENT", "ACKNOWLEDGED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional() }).parse(req.query);
    const where = q.status ? { status: q.status } : {};
    const [data, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({ where, include: purchaseOrderInclude, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: purchaseOrderInclude });
    if (!order) throw Errors.notFound("PurchaseOrder");
    return reply.send(ok(order));
  });

  app.post("/from-sales-order/:salesOrderId", async (req, reply) => {
    const { salesOrderId } = z.object({ salesOrderId: z.string().uuid() }).parse(req.params);
    const body = z.object({
      vendorId: z.string().uuid(),
      currency: z.string().length(3).default("USD"),
      expectedDate: z.string().date().optional(),
      notes: z.string().max(2000).optional(),
      items: z.array(PurchaseItemBody).min(1),
    }).parse(req.body);

    const salesOrder = await prisma.salesOrder.findUnique({ where: { id: salesOrderId }, include: { items: true } });
    if (!salesOrder) throw Errors.notFound("SalesOrder");
    const vendor = await prisma.vendor.findUnique({ where: { id: body.vendorId }, select: { id: true, isActive: true } });
    if (!vendor) throw Errors.notFound("Vendor");
    if (!vendor.isActive) throw Errors.unprocessable("Vendor is inactive");
    const salesItems = new Map(salesOrder.items.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const items = body.items.map((input, index) => {
      if (seen.has(input.salesOrderItemId)) throw Errors.unprocessable("Duplicate sales order item");
      seen.add(input.salesOrderItemId);
      const source = salesItems.get(input.salesOrderItemId);
      if (!source) throw Errors.unprocessable("Purchase item is not part of this sales order");
      const quantity = input.quantity ?? source.quantity;
      if (quantity > source.quantity) throw Errors.unprocessable("Purchase quantity exceeds sales order quantity");
      const unitCost = new Decimal(input.unitCost);
      return { salesOrderItemId: source.id, vendorQuoteId: input.vendorQuoteId ?? null, lineNumber: index + 1, mpn: source.mpn, quantity, unitCost, lineTotal: unitCost.mul(quantity) };
    });
    if (body.items.some((input) => input.vendorQuoteId)) {
      const quoteIds = body.items.flatMap((input) => input.vendorQuoteId ? [input.vendorQuoteId] : []);
      const quotes = await prisma.vendorQuote.findMany({ where: { id: { in: quoteIds } }, include: { vendorRfq: { select: { vendorId: true } } } });
      const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));
      for (const input of body.items) {
        if (!input.vendorQuoteId) continue;
        const quote = quoteById.get(input.vendorQuoteId);
        if (!quote || quote.vendorRfq.vendorId !== body.vendorId) throw Errors.unprocessable("Vendor quote does not belong to the selected vendor");
      }
    }
    const subtotal = items.reduce((sum, item) => sum.add(item.lineTotal), new Decimal(0));

    const po = await prisma.$transaction(async (tx) => {
      const row = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('purchase_order_counter_seq')`;
      const orderNumber = `PO-${new Date().getFullYear()}-${String(row[0].nextval).padStart(6, "0")}`;
      const created = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          salesOrderId,
          vendorId: body.vendorId,
          currency: body.currency,
          subtotal,
          total: subtotal,
          expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
          notes: body.notes ?? null,
          items: { create: items },
        },
        include: purchaseOrderInclude,
      });
      await auditInTx(tx, { userId: req.user!.id, action: "purchase_order.created", entityType: "purchase_order", entityId: created.id });
      return created;
    });
    return reply.status(201).send(ok(po));
  });

  app.patch("/:id/status", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { status } = z.object({ status: z.enum(["DRAFT", "SENT", "ACKNOWLEDGED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]) }).parse(req.body);
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("PurchaseOrder");
    const updated = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({ where: { id }, data: { status }, include: purchaseOrderInclude });
      await auditInTx(tx, { userId: req.user!.id, action: "purchase_order.status_changed", entityType: "purchase_order", entityId: id, newValue: { status } });
      return po;
    });
    return reply.send(ok(updated));
  });
}

export async function adminShipmentsRoutes(app: FastifyInstance): Promise<void> {
  await requireAdmin(app);

  app.get("/", async (req, reply) => {
    const q = PAGE.extend({ status: z.enum(["PROCESSING", "IN_TRANSIT", "CUSTOMS", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]).optional() }).parse(req.query);
    const where = q.status ? { status: q.status } : {};
    const [data, total] = await prisma.$transaction([
      prisma.shipment.findMany({ where, select: shipmentSelect, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.shipment.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.post("/from-sales-order/:salesOrderId", async (req, reply) => {
    const { salesOrderId } = z.object({ salesOrderId: z.string().uuid() }).parse(req.params);
    const body = z.object({ purchaseOrderId: z.string().uuid().optional(), trackingNumber: z.string().max(200).optional(), carrier: z.string().max(100).optional(), origin: z.string().max(200).optional(), destination: z.string().max(200).optional(), eta: z.string().date().optional(), notes: z.string().max(2000).optional() }).parse(req.body);
    const order = await prisma.salesOrder.findUnique({ where: { id: salesOrderId }, select: { id: true } });
    if (!order) throw Errors.notFound("SalesOrder");
    if (body.purchaseOrderId && !(await prisma.purchaseOrder.findFirst({ where: { id: body.purchaseOrderId, salesOrderId } }))) throw Errors.unprocessable("Purchase order does not belong to this sales order");
    const shipment = await prisma.$transaction(async (tx) => {
      const row = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('shipment_counter_seq')`;
      const created = await tx.shipment.create({ data: { shipmentNumber: `SHP-${new Date().getFullYear()}-${String(row[0].nextval).padStart(6, "0")}`, salesOrderId, purchaseOrderId: body.purchaseOrderId ?? null, trackingNumber: body.trackingNumber ?? null, carrier: body.carrier ?? null, origin: body.origin ?? null, destination: body.destination ?? null, eta: body.eta ? new Date(body.eta) : null, notes: body.notes ?? null }, select: shipmentSelect });
      await auditInTx(tx, { userId: req.user!.id, action: "shipment.created", entityType: "shipment", entityId: created.id });
      return created;
    });
    return reply.status(201).send(ok(shipment));
  });

  app.patch("/:id/status", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { status } = z.object({ status: z.enum(["PROCESSING", "IN_TRANSIT", "CUSTOMS", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]) }).parse(req.body);
    const existing = await prisma.shipment.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Shipment");
    const shipment = await prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({ where: { id }, data: { status, deliveredAt: status === "DELIVERED" ? new Date() : existing.deliveredAt }, select: shipmentSelect });
      await auditInTx(tx, { userId: req.user!.id, action: "shipment.status_changed", entityType: "shipment", entityId: id, newValue: { status } });
      return updated;
    });
    return reply.send(ok(shipment));
  });
}

export async function adminInvoicesRoutes(app: FastifyInstance): Promise<void> {
  await requireAdmin(app);

  app.get("/", async (req, reply) => {
    const q = PAGE.extend({ status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional() }).parse(req.query);
    const where = q.status ? { status: q.status } : {};
    const [data, total] = await prisma.$transaction([
      prisma.invoice.findMany({ where, select: invoiceSelect, skip: (q.page - 1) * q.limit, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.invoice.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.post("/from-sales-order/:salesOrderId", async (req, reply) => {
    const { salesOrderId } = z.object({ salesOrderId: z.string().uuid() }).parse(req.params);
    const body = z.object({ dueDate: z.string().date().optional(), notes: z.string().max(2000).optional() }).parse(req.body ?? {});
    const order = await prisma.salesOrder.findUnique({ where: { id: salesOrderId }, include: { items: { orderBy: { lineNumber: "asc" } } } });
    if (!order) throw Errors.notFound("SalesOrder");
    const invoice = await prisma.$transaction(async (tx) => {
      const row = await tx.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('invoice_counter_seq')`;
      const created = await tx.invoice.create({ data: { invoiceNumber: `INV-${new Date().getFullYear()}-${String(row[0].nextval).padStart(6, "0")}`, salesOrderId, customerId: order.customerId, currency: order.currency, subtotal: order.subtotal, tax: order.tax, total: order.total, dueDate: body.dueDate ? new Date(body.dueDate) : null, notes: body.notes ?? null, items: { create: order.items.map((item) => ({ lineNumber: item.lineNumber, mpn: item.mpn, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate, taxAmount: item.taxAmount, lineTotal: item.lineTotal })) } }, select: invoiceSelect });
      await auditInTx(tx, { userId: req.user!.id, action: "invoice.created", entityType: "invoice", entityId: created.id });
      return created;
    });
    return reply.status(201).send(ok(invoice));
  });

  app.patch("/:id/status", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { status } = z.object({ status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]) }).parse(req.body);
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Invoice");
    const invoice = await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({ where: { id }, data: { status, issuedAt: status === "ISSUED" && !existing.issuedAt ? new Date() : existing.issuedAt, paidAt: status === "PAID" ? new Date() : existing.paidAt }, select: invoiceSelect });
      await auditInTx(tx, { userId: req.user!.id, action: "invoice.status_changed", entityType: "invoice", entityId: id, newValue: { status } });
      return updated;
    });
    return reply.send(ok(invoice));
  });
}
