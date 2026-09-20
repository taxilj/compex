import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { auditInTx } from "../../lib/audit.js";
import { assertValidSettingValues } from "../../lib/settings-validation.js";
import { splitBlanks, withCleared } from "../../lib/blank-fields.js";

const ContactEntry = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(50).optional(),
  role: z.string().trim().max(100).optional(),
});

const VendorBody = z.object({
  name: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  // Owner's Vendor Master fields -- Settings-backed LOV fields
  // (paymentCurrency, paymentTerms, industrySegment, businessType) are
  // validated against the Setting table below, never hardcoded here.
  contactName: z.string().trim().max(200).optional(),
  vendorCode: z.string().trim().max(100).optional(),
  billToAddress: z.string().trim().max(500).optional(),
  shipToAddress: z.string().trim().max(500).optional(),
  country: z.string().trim().max(100).optional(),
  telephone: z.string().trim().max(30).optional(),
  fax: z.string().trim().max(50).optional(),
  mobile: z.string().trim().max(30).optional(),
  website: z.string().trim().max(300).optional(),
  otherOffices: z.string().trim().max(1000).optional(),
  mov: z.number().nonnegative().max(1_000_000_000).optional(),
  paymentCurrency: z.string().trim().max(10).optional(),
  paymentTerms: z.string().trim().max(100).optional(),
  shippingAccount: z.string().trim().max(200).optional(),
  bankDetails: z.string().trim().max(1000).optional(),
  creditLimit: z.number().nonnegative().max(1_000_000_000).optional(),
  industrySegment: z.string().trim().max(100).optional(),
  businessType: z.string().trim().max(100).optional(),
  speciality: z.string().trim().max(200).optional(),
  gstOrRegistrationNumber: z.string().trim().max(50).optional(),
  contacts: z.array(ContactEntry).max(50).optional(),
});

const VENDOR_REQUIRED_KEYS = ["name", "contactEmail"] as const;

async function validateVendorRefs(
  body: Partial<z.infer<typeof VendorBody>>,
): Promise<void> {
  await assertValidSettingValues([
    { category: "COUNTRY", value: body.country },
    { category: "CURRENCY", value: body.paymentCurrency },
    { category: "PAYMENT_TERMS", value: body.paymentTerms },
    { category: "INDUSTRY_SEGMENT", value: body.industrySegment },
    { category: "BUSINESS_TYPE", value: body.businessType },
  ]);
}

export async function adminVendorsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const q = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(50),
      search: z.string().trim().max(200).optional(),
    }).parse(req.query);
    const where = q.search ? {
      OR: [
        { name: { contains: q.search, mode: "insensitive" as const } },
        { vendorCode: { contains: q.search, mode: "insensitive" as const } },
        { contactEmail: { contains: q.search, mode: "insensitive" as const } },
      ],
    } : {};
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.vendor.findMany({ where, skip, take: q.limit, orderBy: { name: "asc" } }),
      prisma.vendor.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw Errors.notFound("Vendor");
    return reply.send(ok(vendor));
  });

  app.post("/", async (req, reply) => {
    const { clean } = splitBlanks(req.body, Object.keys(VendorBody.shape), VENDOR_REQUIRED_KEYS);
    const body = VendorBody.parse(clean);
    await validateVendorRefs(body);
    if (body.vendorCode) {
      const clash = await prisma.vendor.findUnique({ where: { vendorCode: body.vendorCode }, select: { id: true } });
      if (clash) throw Errors.conflict("A vendor with this vendor code already exists");
    }
    const vendor = await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.create({ data: body });
      const { bankDetails: _bankDetails, ...safeValue } = v;
      await auditInTx(tx, { userId: req.user!.id, action: "vendor.created", entityType: "vendor", entityId: v.id, newValue: safeValue });
      return v;
    });
    return reply.status(201).send(ok(vendor));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Vendor");
    const { clean, cleared } = splitBlanks(req.body, Object.keys(VendorBody.shape), VENDOR_REQUIRED_KEYS);
    const body = VendorBody.partial().parse(clean);
    await validateVendorRefs(body);
    if (body.vendorCode && body.vendorCode !== existing.vendorCode) {
      const clash = await prisma.vendor.findUnique({ where: { vendorCode: body.vendorCode }, select: { id: true } });
      if (clash) throw Errors.conflict("A vendor with this vendor code already exists");
    }
    const vendor = await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({ where: { id }, data: withCleared(body, cleared) });
      const { bankDetails: _oldBank, ...safeOld } = existing;
      const { bankDetails: _newBank, ...safeNew } = v;
      await auditInTx(tx, { userId: req.user!.id, action: "vendor.updated", entityType: "vendor", entityId: id, oldValue: safeOld, newValue: safeNew });
      return v;
    });
    return reply.send(ok(vendor));
  });

  // Deactivate/reactivate instead of hard delete -- a vendor referenced by
  // existing VendorRfqs can't be removed without breaking that history, and
  // the owner's requirement is explicitly "existing records remain valid if
  // a setting/record is deactivated," not deleted.
  app.post("/:id/deactivate", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Vendor");
    const vendor = await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({ where: { id }, data: { isActive: false } });
      await auditInTx(tx, { userId: req.user!.id, action: "vendor.deactivated", entityType: "vendor", entityId: id });
      return v;
    });
    return reply.send(ok(vendor));
  });

  app.post("/:id/activate", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Vendor");
    const vendor = await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.update({ where: { id }, data: { isActive: true } });
      await auditInTx(tx, { userId: req.user!.id, action: "vendor.activated", entityType: "vendor", entityId: id });
      return v;
    });
    return reply.send(ok(vendor));
  });
}
