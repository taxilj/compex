import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { auditInTx } from "../../lib/audit.js";

const OrganizationBody = z.object({
  companyName: z.string().min(1).max(200),
  shortName: z.string().min(1).max(50),
  address: z.string().max(1000).optional(),
  country: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().max(300).optional(),
  contactPerson: z.string().max(200).optional(),
  ffAccount: z.string().max(200).optional(),
  currency: z.string().length(3).default("INR"),
  companyRegistrationNo: z.string().max(100).optional(),
  invoicePrefix: z.string().max(20).optional(),
  proformaInvoicePrefix: z.string().max(20).optional(),
  packingSlipPrefix: z.string().max(20).optional(),
  cocPrefix: z.string().max(20).optional(),
  orderAckPrefix: z.string().max(20).optional(),
  quotationPrefix: z.string().max(20).optional(),
  salesOrderPrefix: z.string().max(20).optional(),
  purchaseOrderPrefix: z.string().max(20).optional(),
  itemNoPrefix: z.string().max(20).optional(),
  vendorCodePrefix: z.string().max(20).optional(),
  customerCodePrefix: z.string().max(20).optional(),
  contactCodePrefix: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
  rmaPrefix: z.string().max(20).optional(),
  bankName: z.string().max(200).optional(),
  bankAccount: z.string().max(100).optional(),
  bankAddress: z.string().max(500).optional(),
  swiftIfscMicr: z.string().max(100).optional(),
  routingCode: z.string().max(100).optional(),
  signatureUrl: z.string().max(500).optional(),
  logoUrl: z.string().max(500).optional(),
});

export async function adminOrganizationsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const q = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(50) }).parse(req.query);
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.organization.findMany({ skip, take: q.limit, orderBy: { companyName: "asc" } }),
      prisma.organization.count(),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) throw Errors.notFound("Organization");
    return reply.send(ok(org));
  });

  app.post("/", async (req, reply) => {
    const org = await prisma.$transaction(async (tx) => {
      const o = await tx.organization.create({ data: OrganizationBody.parse(req.body) });
      await auditInTx(tx, { userId: req.user!.id, action: "organization.created", entityType: "organization", entityId: o.id, newValue: o });
      return o;
    });
    return reply.status(201).send(ok(org));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Organization");
    const org = await prisma.$transaction(async (tx) => {
      const o = await tx.organization.update({ where: { id }, data: OrganizationBody.partial().parse(req.body) });
      await auditInTx(tx, { userId: req.user!.id, action: "organization.updated", entityType: "organization", entityId: id, oldValue: existing, newValue: o });
      return o;
    });
    return reply.send(ok(org));
  });
}
