import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Errors } from "../../lib/errors.js";
import { auditInTx } from "../../lib/audit.js";
import { accountSetupEmail, sendEmail } from "../../lib/email.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ok, paginated } from "../../lib/response.js";
import { hashToken } from "../../lib/jwt.js";

const CustomerBody = z.object({
  companyName: z.string().trim().min(2).max(200),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().trim().min(7).max(20).optional(),
  gstin: z.string().trim().max(15).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
});

const CustomerSelect = {
  id: true,
  accountNumber: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true } },
  company: { select: { id: true, name: true, gstin: true, city: true, address: true } },
  _count: { select: { rfqs: true, quotations: true } },
} as const;

function newAccountNumber(): string {
  return `CX-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function toAuditValue(customer: { id: string; accountNumber: string; user: { email: string; firstName: string; lastName: string; phone: string | null; status: string }; company: { name: string; gstin: string | null; city: string | null; address: string | null } }) {
  return { id: customer.id, accountNumber: customer.accountNumber, user: customer.user, company: customer.company };
}

export async function adminCustomersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const query = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(50), q: z.string().trim().max(200).optional() }).parse(req.query);
    const where = query.q ? {
      OR: [
        { accountNumber: { contains: query.q, mode: "insensitive" as const } },
        { user: { email: { contains: query.q, mode: "insensitive" as const } } },
        { user: { firstName: { contains: query.q, mode: "insensitive" as const } } },
        { user: { lastName: { contains: query.q, mode: "insensitive" as const } } },
        { company: { name: { contains: query.q, mode: "insensitive" as const } } },
      ],
    } : {};
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await prisma.$transaction([
      prisma.customer.findMany({ where, select: CustomerSelect, orderBy: { createdAt: "desc" }, skip, take: query.limit }),
      prisma.customer.count({ where }),
    ]);
    return reply.send(paginated(data, total, query.page, query.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const customer = await prisma.customer.findUnique({ where: { id }, select: CustomerSelect });
    if (!customer) throw Errors.notFound("Customer");
    return reply.send(ok(customer));
  });

  app.post("/", async (req, reply) => {
    const body = CustomerBody.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) throw Errors.conflict("An account with this email already exists");

    const setupToken = crypto.randomBytes(32).toString("hex");
    const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 12);
    const customer = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { name: body.companyName, gstin: body.gstin, city: body.city, address: body.address } });
      const user = await tx.user.create({ data: { email: body.email, passwordHash: unusablePasswordHash, firstName: body.firstName, lastName: body.lastName, phone: body.phone, status: "PENDING_VERIFICATION" } });
      const created = await tx.customer.create({ data: { userId: user.id, companyId: company.id, accountNumber: newAccountNumber() }, select: CustomerSelect });
      await tx.accountSetupToken.create({ data: { userId: user.id, tokenHash: hashToken(setupToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      await auditInTx(tx, { userId: req.user!.id, action: "customer.invited", entityType: "customer", entityId: created.id, newValue: toAuditValue(created) });
      return created;
    });

    try {
      const actionUrl = `${env.CORS_ORIGIN}/setup-account?token=${encodeURIComponent(setupToken)}`;
      await sendEmail({ to: body.email, subject: "Set up your Compex Solution customer account", html: accountSetupEmail(setupToken, env.CORS_ORIGIN), testActionUrl: actionUrl });
    } catch {
      // This request created the exact customer below; it has no RFQs,
      // quotations, or documents. Clean only those known IDs on delivery failure.
      await prisma.$transaction([
        prisma.accountSetupToken.deleteMany({ where: { userId: customer.user.id } }),
        prisma.customer.delete({ where: { id: customer.id } }),
        prisma.user.delete({ where: { id: customer.user.id } }),
        prisma.company.delete({ where: { id: customer.company.id } }),
      ]);
      throw Errors.serviceUnavailable("Customer invitation could not be delivered because email is not configured");
    }

    return reply.status(201).send(ok(customer));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = CustomerBody.partial().parse(req.body);
    const existing = await prisma.customer.findUnique({ where: { id }, select: CustomerSelect });
    if (!existing) throw Errors.notFound("Customer");
    if (body.email && body.email !== existing.user.email) {
      const emailOwner = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
      if (emailOwner && emailOwner.id !== existing.user.id) throw Errors.conflict("An account with this email already exists");
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (body.companyName || body.gstin !== undefined || body.city !== undefined || body.address !== undefined) {
        await tx.company.update({ where: { id: existing.company.id }, data: { name: body.companyName, gstin: body.gstin, city: body.city, address: body.address } });
      }
      if (body.email || body.firstName || body.lastName || body.phone !== undefined) {
        await tx.user.update({ where: { id: existing.user.id }, data: { email: body.email, firstName: body.firstName, lastName: body.lastName, phone: body.phone } });
      }
      const result = await tx.customer.findUniqueOrThrow({ where: { id }, select: CustomerSelect });
      await auditInTx(tx, { userId: req.user!.id, action: "customer.updated", entityType: "customer", entityId: id, oldValue: toAuditValue(existing), newValue: toAuditValue(result) });
      return result;
    });
    return reply.send(ok(updated));
  });
}
