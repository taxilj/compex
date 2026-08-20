import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../lib/audit.js";

const CostBody = z.object({
  vendorQuoteId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  currency: z.string().length(3).default("INR"),
  exchangeRate: z.number().positive().default(1),
  shipping: z.number().min(0).default(0),
  insurance: z.number().min(0).default(0),
  customsDuty: z.number().min(0).default(0),
  igst: z.number().min(0).default(0),
  handling: z.number().min(0).default(0),
  otherCosts: z.number().min(0).default(0),
  marginPercent: z.number().min(0).max(1000).default(0),
  notes: z.string().max(2000).optional(),
});

// All arithmetic in Decimal — no floats for financial calculations
function calcLandedCost(unitCost: Decimal, body: { quantity: number; exchangeRate: number; shipping: number; insurance: number; customsDuty: number; igst: number; handling: number; otherCosts: number; marginPercent: number }) {
  const D = (n: number) => new Decimal(n);
  const productCost = unitCost.mul(D(body.quantity)).mul(D(body.exchangeRate));
  const landedCost = productCost
    .add(D(body.shipping))
    .add(D(body.insurance))
    .add(D(body.customsDuty))
    .add(D(body.igst))
    .add(D(body.handling))
    .add(D(body.otherCosts));
  const customerPrice = landedCost.mul(D(1).add(D(body.marginPercent).div(D(100))));
  return {
    productCost: productCost.toDecimalPlaces(4),
    landedCost: landedCost.toDecimalPlaces(4),
    customerPrice: customerPrice.toDecimalPlaces(4),
  };
}

async function resolveUnitCost(vendorQuoteId?: string | null): Promise<Decimal> {
  if (!vendorQuoteId) return new Decimal(0);
  const q = await prisma.vendorQuote.findUnique({ where: { id: vendorQuoteId }, select: { unitCost: true } });
  if (!q) throw Errors.notFound("VendorQuote");
  return q.unitCost;
}

export async function adminLandedCostRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/:id/landed-cost", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const lc = await prisma.landedCost.findUnique({
      where: { vendorRfqId: id },
      include: { vendorQuote: { select: { id: true, unitCost: true, currency: true } } },
    });
    if (!lc) throw Errors.notFound("LandedCost");
    return reply.send(ok(lc));
  });

  app.post("/:id/landed-cost", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = CostBody.parse(req.body);

    const vrfq = await prisma.vendorRfq.findUnique({ where: { id }, select: { id: true } });
    if (!vrfq) throw Errors.notFound("VendorRfq");

    const existing = await prisma.landedCost.findUnique({ where: { vendorRfqId: id } });
    if (existing) throw Errors.unprocessable("Landed cost already exists — use PATCH to update");

    const unitCost = await resolveUnitCost(body.vendorQuoteId);
    const { productCost, landedCost, customerPrice } = calcLandedCost(unitCost, body);

    const lc = await prisma.landedCost.create({
      data: {
        vendorRfqId: id,
        vendorQuoteId: body.vendorQuoteId ?? null,
        currency: body.currency,
        exchangeRate: new Decimal(body.exchangeRate),
        quantity: body.quantity,
        shipping: new Decimal(body.shipping),
        insurance: new Decimal(body.insurance),
        customsDuty: new Decimal(body.customsDuty),
        igst: new Decimal(body.igst),
        handling: new Decimal(body.handling),
        otherCosts: new Decimal(body.otherCosts),
        marginPercent: new Decimal(body.marginPercent),
        productCost,
        landedCost,
        customerPrice,
        notes: body.notes,
      },
    });

    audit({ userId: req.user!.id, action: "landed_cost.created", entityType: "landed_cost", entityId: lc.id });
    return reply.status(201).send(ok(lc));
  });

  app.patch("/:id/landed-cost", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = CostBody.partial().parse(req.body);

    const existing = await prisma.landedCost.findUnique({ where: { vendorRfqId: id } });
    if (!existing) throw Errors.notFound("LandedCost");

    const m = {
      vendorQuoteId: "vendorQuoteId" in body ? body.vendorQuoteId : existing.vendorQuoteId,
      quantity: body.quantity ?? existing.quantity,
      exchangeRate: body.exchangeRate ?? Number(existing.exchangeRate),
      shipping: body.shipping ?? Number(existing.shipping),
      insurance: body.insurance ?? Number(existing.insurance),
      customsDuty: body.customsDuty ?? Number(existing.customsDuty),
      igst: body.igst ?? Number(existing.igst),
      handling: body.handling ?? Number(existing.handling),
      otherCosts: body.otherCosts ?? Number(existing.otherCosts),
      marginPercent: body.marginPercent ?? Number(existing.marginPercent),
    };

    const unitCost = await resolveUnitCost(m.vendorQuoteId);
    const { productCost, landedCost, customerPrice } = calcLandedCost(unitCost, m);

    const lc = await prisma.landedCost.update({
      where: { vendorRfqId: id },
      data: {
        vendorQuoteId: m.vendorQuoteId ?? null,
        currency: body.currency ?? existing.currency,
        exchangeRate: new Decimal(m.exchangeRate),
        quantity: m.quantity,
        shipping: new Decimal(m.shipping),
        insurance: new Decimal(m.insurance),
        customsDuty: new Decimal(m.customsDuty),
        igst: new Decimal(m.igst),
        handling: new Decimal(m.handling),
        otherCosts: new Decimal(m.otherCosts),
        marginPercent: new Decimal(m.marginPercent),
        productCost,
        landedCost,
        customerPrice,
        notes: body.notes ?? existing.notes,
      },
    });

    audit({ userId: req.user!.id, action: "landed_cost.updated", entityType: "landed_cost", entityId: existing.id });
    return reply.send(ok(lc));
  });
}
