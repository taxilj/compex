import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
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
import { assertValidSettingValues } from "../../lib/settings-validation.js";

const ContactEntry = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(50).optional(),
  role: z.string().trim().max(100).optional(),
});

const CustomerBody = z.object({
  companyName: z.string().trim().min(2).max(200),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().trim().min(7).max(20).optional(),
  gstin: z.string().trim().max(15).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  // Owner's Customer Master fields -- Settings-backed LOV fields
  // (relationshipType, customerType, paymentTerms, region, industrySegment,
  // state, country) are validated against the Setting table below, never
  // hardcoded here. salesPersonId/salesCoordinatorId/sourcingOwnerId are
  // real User references, validated to exist below.
  shortName: z.string().trim().max(200).optional(),
  billToAddress: z.string().trim().max(500).optional(),
  shipToAddress: z.string().trim().max(500).optional(),
  additionalShipToAddresses: z.array(z.string().trim().max(500)).max(50).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  relationshipType: z.string().trim().max(50).optional(),
  customerType: z.string().trim().max(50).optional(),
  website: z.string().trim().max(300).optional(),
  fax: z.string().trim().max(50).optional(),
  primaryContact: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().email().optional(),
  authorisedPerson: z.string().trim().max(200).optional(),
  paymentTerms: z.string().trim().max(100).optional(),
  creditLimit: z.number().nonnegative().max(1_000_000_000).optional(),
  region: z.string().trim().max(100).optional(),
  salesPersonId: z.string().uuid().nullable().optional(),
  salesCoordinatorId: z.string().uuid().nullable().optional(),
  sourcingOwnerId: z.string().uuid().nullable().optional(),
  internalAccountNumber: z.string().trim().max(100).optional(),
  shippingAccount: z.string().trim().max(200).optional(),
  bankDetails: z.string().trim().max(1000).optional(),
  industrySegment: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(2000).optional(),
  contacts: z.array(ContactEntry).max(50).optional(),
});

type CustomerBodyShape = z.infer<typeof CustomerBody>;

const CustomerSelect = {
  id: true,
  accountNumber: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true } },
  company: {
    select: {
      id: true, name: true, gstin: true, city: true, address: true,
      shortName: true, billToAddress: true, shipToAddress: true, additionalShipToAddresses: true,
      state: true, country: true, relationshipType: true, customerType: true, website: true, fax: true,
      primaryContact: true, contactEmail: true, authorisedPerson: true, paymentTerms: true, creditLimit: true,
      region: true, internalAccountNumber: true, shippingAccount: true, bankDetails: true, industrySegment: true,
      remarks: true, contacts: true,
      salesPerson: { select: { id: true, firstName: true, lastName: true } },
      salesCoordinator: { select: { id: true, firstName: true, lastName: true } },
      sourcingOwner: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  _count: { select: { rfqs: true, quotations: true } },
} as const;

type CustomerRecord = Prisma.CustomerGetPayload<{ select: typeof CustomerSelect }>;

function newAccountNumber(): string {
  return `CX-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

// Bank details are never included in audit snapshots (security rule: never
// log bank details or full private payloads), even though this endpoint and
// the AuditLog it writes to are both admin-only.
function toAuditValue(customer: CustomerRecord) {
  // These values are operationally necessary in the admin response, but audit
  // history has a much wider retention/reader surface. Never persist account
  // or credit data there.
  const {
    bankDetails: _bankDetails,
    creditLimit: _creditLimit,
    internalAccountNumber: _internalAccountNumber,
    shippingAccount: _shippingAccount,
    ...companySafe
  } = customer.company;
  return { id: customer.id, accountNumber: customer.accountNumber, user: customer.user, company: companySafe };
}

function companyData(body: Partial<CustomerBodyShape>) {
  return {
    name: body.companyName,
    gstin: body.gstin,
    city: body.city,
    address: body.address,
    shortName: body.shortName,
    billToAddress: body.billToAddress,
    shipToAddress: body.shipToAddress,
    additionalShipToAddresses: body.additionalShipToAddresses,
    state: body.state,
    country: body.country,
    relationshipType: body.relationshipType,
    customerType: body.customerType,
    website: body.website,
    fax: body.fax,
    primaryContact: body.primaryContact,
    contactEmail: body.contactEmail,
    authorisedPerson: body.authorisedPerson,
    paymentTerms: body.paymentTerms,
    creditLimit: body.creditLimit,
    region: body.region,
    salesPersonId: body.salesPersonId,
    salesCoordinatorId: body.salesCoordinatorId,
    sourcingOwnerId: body.sourcingOwnerId,
    internalAccountNumber: body.internalAccountNumber,
    shippingAccount: body.shippingAccount,
    bankDetails: body.bankDetails,
    industrySegment: body.industrySegment,
    remarks: body.remarks,
    contacts: body.contacts,
  };
}

// Settings-backed LOV fields never accept an arbitrary string -- only a
// real, currently-active Setting value for that category. Real User
// references (sales person/coordinator/sourcing owner) are checked for
// existence separately since they are FKs, not Settings values.
async function validateCustomerRefs(body: Partial<CustomerBodyShape>): Promise<void> {
  await assertValidSettingValues([
    { category: "COUNTRY", value: body.country },
    { category: "STATE", value: body.state },
    { category: "REGION", value: body.region },
    { category: "RELATIONSHIP_TYPE", value: body.relationshipType },
    { category: "CUSTOMER_TYPE", value: body.customerType },
    { category: "PAYMENT_TERMS", value: body.paymentTerms },
    { category: "INDUSTRY_SEGMENT", value: body.industrySegment },
  ]);
  const userRefs: Array<[string, string | null | undefined]> = [
    ["salesPersonId", body.salesPersonId],
    ["salesCoordinatorId", body.salesCoordinatorId],
    ["sourcingOwnerId", body.sourcingOwnerId],
  ];
  for (const [field, id] of userRefs) {
    if (!id) continue;
    const exists = await prisma.user.findFirst({
      where: { id, role: { in: ["STAFF", "ADMIN"] } },
      select: { id: true },
    });
    if (!exists) throw Errors.validation(`${field} does not reference an existing user`);
  }
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
        { company: { gstin: { contains: query.q, mode: "insensitive" as const } } },
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
    await validateCustomerRefs(body);

    const setupToken = crypto.randomBytes(32).toString("hex");
    const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 12);
    const customer = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { ...companyData(body), name: body.companyName } });
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
    await validateCustomerRefs(body);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: existing.company.id }, data: companyData(body) });
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
