import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../lib/audit.js";
import { sendEmail, quotationEmail } from "../../lib/email.js";
import { generateQuotationNumber } from "./quotation-number.js";
import { generateQuotationPdf } from "../../lib/pdf.js";
import { env } from "../../config/env.js";
import { cancelFollowUps } from "../../jobs/follow-up-scheduler.js";

const QUOTATION_SELECT = {
  id: true,
  quotationNumber: true,
  rfqId: true,
  customerId: true,
  status: true,
  currency: true,
  subtotal: true,
  tax: true,
  total: true,
  validUntil: true,
  notes: true,
  deliveryTerms: true,
  paymentTerms: true,
  sentAt: true,
  viewedAt: true,
  respondedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  customer: {
    select: {
      id: true,
      accountNumber: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      company: { select: { name: true } },
    },
  },
  rfq: { select: { id: true, rfqNumber: true } },
  items: {
    select: {
      id: true,
      lineNumber: true,
      mpn: true,
      manufacturer: true,
      description: true,
      quantity: true,
      unitPrice: true,
      taxRate: true,
      taxAmount: true,
      lineTotal: true,
      notes: true,
    },
    orderBy: { lineNumber: "asc" as const },
  },
} as const;

const ItemBody = z.object({
  rfqItemId: z.string().uuid().optional(),
  lineNumber: z.number().int().positive(),
  mpn: z.string().min(1).max(100),
  manufacturer: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().max(1000).optional(),
});

const CreateBody = z.object({
  rfqId: z.string().uuid(),
  customerId: z.string().uuid(),
  landedCostId: z.string().uuid().optional(),
  currency: z.string().length(3).default("INR"),
  validUntil: z.string().date(),
  notes: z.string().max(5000).optional(),
  deliveryTerms: z.string().max(500).optional(),
  paymentTerms: z.string().max(500).optional(),
  items: z.array(ItemBody).min(1),
});

const PatchBody = z.object({
  currency: z.string().length(3).optional(),
  validUntil: z.string().date().optional(),
  notes: z.string().max(5000).optional().nullable(),
  deliveryTerms: z.string().max(500).optional().nullable(),
  paymentTerms: z.string().max(500).optional().nullable(),
  items: z.array(ItemBody).min(1).optional(),
});

function calcItems(rawItems: z.infer<typeof ItemBody>[]) {
  const D = (n: number) => new Decimal(n);
  let subtotal = new Decimal(0);
  let totalTax = new Decimal(0);

  const items = rawItems.map((item) => {
    const lineBase = D(item.unitPrice).mul(D(item.quantity));
    const taxAmount = lineBase.mul(D(item.taxRate)).div(D(100)).toDecimalPlaces(4);
    const lineTotal = lineBase.add(taxAmount).toDecimalPlaces(4);
    subtotal = subtotal.add(lineBase);
    totalTax = totalTax.add(taxAmount);
    return {
      rfqItemId: item.rfqItemId ?? null,
      lineNumber: item.lineNumber,
      mpn: item.mpn,
      manufacturer: item.manufacturer ?? null,
      description: item.description ?? null,
      quantity: item.quantity,
      unitPrice: D(item.unitPrice).toDecimalPlaces(4),
      taxRate: D(item.taxRate).toDecimalPlaces(4),
      taxAmount,
      lineTotal,
      notes: item.notes ?? null,
    };
  });

  return {
    items,
    subtotal: subtotal.toDecimalPlaces(4),
    tax: totalTax.toDecimalPlaces(4),
    total: subtotal.add(totalTax).toDecimalPlaces(4),
  };
}

// ponytail: any accepted here — internal-only helper, QUOTATION_SELECT guarantees the shape at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPdfData(q: any, customerName: string) {
  return {
    quotationNumber: q.quotationNumber as string,
    customerName,
    companyName: q.customer.company.name as string,
    validUntil: q.validUntil as Date,
    currency: q.currency as string,
    items: (q.items as { mpn: string; description: string | null; quantity: number; unitPrice: Decimal; taxRate: Decimal; lineTotal: Decimal }[]).map((item) => ({
      partNumber: item.mpn,
      description: item.description ?? item.mpn,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      taxRate: item.taxRate.toFixed(2),
      lineTotal: item.lineTotal.toFixed(2),
    })),
    subtotal: (q.subtotal as Decimal).toFixed(2),
    tax: (q.tax as Decimal).toFixed(2),
    total: (q.total as Decimal).toFixed(2),
    deliveryTerms: q.deliveryTerms as string | null,
    paymentTerms: q.paymentTerms as string | null,
    notes: q.notes as string | null,
  };
}

export async function adminQuotationsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const q = z.object({
      rfqId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);

    const where = {
      ...(q.rfqId && { rfqId: q.rfqId }),
      ...(q.customerId && { customerId: q.customerId }),
      ...(q.status && { status: q.status }),
    };
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.quotation.findMany({ where, select: QUOTATION_SELECT, skip, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.quotation.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const q = await prisma.quotation.findUnique({ where: { id }, select: QUOTATION_SELECT });
    if (!q) throw Errors.notFound("Quotation");
    return reply.send(ok(q));
  });

  app.post("/", async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const { items, subtotal, tax, total } = calcItems(body.items);
    const quotationNumber = await generateQuotationNumber();
    const rfq = await prisma.rfq.findUnique({ where: { id: body.rfqId }, select: { customerId: true } });
    if (!rfq || rfq.customerId !== body.customerId) throw Errors.unprocessable("RFQ does not belong to this customer");

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        rfqId: body.rfqId,
        customerId: body.customerId,
        landedCostId: body.landedCostId ?? null,
        currency: body.currency,
        validUntil: new Date(body.validUntil),
        subtotal,
        tax,
        total,
        notes: body.notes ?? null,
        deliveryTerms: body.deliveryTerms ?? null,
        paymentTerms: body.paymentTerms ?? null,
        createdById: req.user!.id,
        items: { create: items },
      },
      select: QUOTATION_SELECT,
    });

    audit({ userId: req.user!.id, action: "quotation.created", entityType: "quotation", entityId: quotation.id });
    return reply.status(201).send(ok(quotation));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.quotation.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw Errors.notFound("Quotation");
    if (existing.status !== "DRAFT") throw Errors.unprocessable("Only DRAFT quotations can be edited");

    const body = PatchBody.parse(req.body);
    const itemCalc = body.items ? calcItems(body.items) : null;

    const quotation = await prisma.$transaction(async (tx) => {
      if (itemCalc) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        await tx.quotationItem.createMany({ data: itemCalc.items.map((i) => ({ ...i, quotationId: id })) });
      }
      return tx.quotation.update({
        where: { id },
        data: {
          ...(body.currency && { currency: body.currency }),
          ...(body.validUntil && { validUntil: new Date(body.validUntil) }),
          notes: body.notes,
          deliveryTerms: body.deliveryTerms,
          paymentTerms: body.paymentTerms,
          ...(itemCalc && { subtotal: itemCalc.subtotal, tax: itemCalc.tax, total: itemCalc.total }),
        },
        select: QUOTATION_SELECT,
      });
    });

    audit({ userId: req.user!.id, action: "quotation.updated", entityType: "quotation", entityId: id });
    return reply.send(ok(quotation));
  });

  app.post("/:id/send", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const q = await prisma.quotation.findUnique({ where: { id }, select: QUOTATION_SELECT });
    if (!q) throw Errors.notFound("Quotation");
    if (q.status !== "DRAFT" && q.status !== "SENT") {
      throw Errors.unprocessable("Cannot send a quotation with status: " + q.status);
    }

    const customerName = `${q.customer.user.firstName} ${q.customer.user.lastName}`;

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateQuotationPdf(buildPdfData(q, customerName));
    } catch (err) {
      console.error("[PDF] Generation failed:", err);
      throw Errors.internal("PDF generation failed");
    }

    const portalUrl = `${env.CORS_ORIGIN}/portal/quotes/${id}`;

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
      select: QUOTATION_SELECT,
    });

    sendEmail({
      to: q.customer.user.email,
      subject: `Quotation Ready — ${q.quotationNumber}`,
      html: quotationEmail(customerName, q.quotationNumber, q.total.toFixed(2), q.currency, q.validUntil.toLocaleDateString("en-IN"), portalUrl),
      attachments: [{ filename: `${q.quotationNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
    }).catch((err) => console.error("[EMAIL] Quotation send failed:", err));

    cancelFollowUps(q.rfqId).catch((err) => console.error("[FOLLOWUP] Cancel after send failed:", err));

    audit({ userId: req.user!.id, action: "quotation.sent", entityType: "quotation", entityId: id });
    return reply.send(ok(updated));
  });

  app.get("/:id/pdf", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const q = await prisma.quotation.findUnique({ where: { id }, select: QUOTATION_SELECT });
    if (!q) throw Errors.notFound("Quotation");

    const customerName = `${q.customer.user.firstName} ${q.customer.user.lastName}`;
    const pdfBuffer = await generateQuotationPdf(buildPdfData(q, customerName));

    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `attachment; filename="${q.quotationNumber}.pdf"`)
      .send(pdfBuffer);
  });
}
