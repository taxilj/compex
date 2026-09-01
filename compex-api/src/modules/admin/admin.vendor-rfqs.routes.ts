import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { audit, auditInTx } from "../../lib/audit.js";
import { nextVendorRfqNumber } from "./vendor-rfq-number.js";
import { sendEmail, vendorRfqEmail } from "../../lib/email.js";

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
      await auditInTx(tx, {
        userId: req.user!.id,
        action: "vendor_quote.created",
        entityType: "vendor_quote",
        entityId: q.id,
        newValue: { vendorRfqId: id, rfqItemId: body.rfqItemId, unitCost: body.unitCost, currency: body.currency, leadTimeDays: body.leadTimeDays, moq: body.moq },
      });
      return q;
    });

    return reply.status(201).send(ok(quote));
  });

  // Send the vendor RFQ to the vendor (DRAFT -> SENT). Email delivery is
  // best-effort — a broken/unconfigured mail provider never blocks the
  // status transition itself.
  app.post("/:id/send", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const vrfq = await prisma.vendorRfq.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        notes: true,
        vendorRfqNumber: true,
        vendor: { select: { name: true, contactEmail: true } },
        items: { select: { quantity: true, rfqItem: { select: { mpn: true, manufacturer: true } } } },
      },
    });
    if (!vrfq) throw Errors.notFound("VendorRfq");
    if (vrfq.status !== "DRAFT") {
      throw Errors.unprocessable(`Cannot send a vendor RFQ with status: ${vrfq.status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.vendorRfq.update({
        where: { id },
        data: { status: "SENT", emailSentAt: new Date() },
        select: VENDOR_RFQ_SELECT,
      });
      await auditInTx(tx, {
        userId: req.user!.id,
        action: "vendor_rfq.sent",
        entityType: "vendor_rfq",
        entityId: id,
        newValue: { vendorRfqNumber: vrfq.vendorRfqNumber },
      });
      return u;
    });

    sendEmail({
      to: vrfq.vendor.contactEmail,
      subject: `Request for Quotation — ${vrfq.vendorRfqNumber}`,
      html: vendorRfqEmail(
        vrfq.vendor.name,
        vrfq.vendorRfqNumber,
        vrfq.items.map((i) => ({ mpn: i.rfqItem.mpn, manufacturer: i.rfqItem.manufacturer, quantity: i.quantity })),
        vrfq.notes,
      ),
    }).catch((err) => console.error("[EMAIL] Vendor RFQ send failed:", err));

    return reply.send(ok(updated));
  });

  // Mark a vendor quote as the selected winner for its RFQ line item — any
  // other still-open (RECEIVED) quote for the same line item, across any
  // vendor, is automatically rejected so there is exactly one winner per item.
  app.patch("/:id/quotes/:quoteId", async (req, reply) => {
    const { id, quoteId } = z.object({ id: z.string().uuid(), quoteId: z.string().uuid() }).parse(req.params);
    const { status } = z.object({ status: z.enum(["SELECTED", "REJECTED"]) }).parse(req.body);

    const quote = await prisma.vendorQuote.findFirst({ where: { id: quoteId, vendorRfqId: id } });
    if (!quote) throw Errors.notFound("VendorQuote");

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        // Serialize quote decisions for one RFQ item before touching any quote
        // rows. Without this, simultaneous selections lock their own quote
        // first and then deadlock while rejecting each other.
        await tx.$queryRaw`
          SELECT "id"
          FROM "rfq_items"
          WHERE "id" = ${quote.rfqItemId}::uuid
          FOR UPDATE
        `;
        const claimed = await tx.vendorQuote.updateMany({
          where: { id: quoteId, vendorRfqId: id, status: "RECEIVED" },
          data: { status },
        });
        if (claimed.count !== 1) {
          throw Errors.unprocessable("Only RECEIVED vendor quotes can be selected or rejected");
        }
        if (status === "SELECTED") {
          await tx.vendorQuote.updateMany({
            where: { rfqItemId: quote.rfqItemId, status: "RECEIVED", id: { not: quoteId } },
            data: { status: "REJECTED" },
          });
        }
        const q = await tx.vendorQuote.findUniqueOrThrow({ where: { id: quoteId } });
        await auditInTx(tx, {
          userId: req.user!.id,
          action: status === "SELECTED" ? "vendor_quote.selected" : "vendor_quote.rejected",
          entityType: "vendor_quote",
          entityId: quoteId,
          oldValue: { status: quote.status },
          newValue: { status },
        });
        return q;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw Errors.conflict("Another vendor quote is already selected for this RFQ line");
      }
      throw error;
    }

    return reply.send(ok(updated));
  });
}
