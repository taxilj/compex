import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { auditInTx } from "../../lib/audit.js";
import { PRODUCT_INCLUDE, searchProducts } from "../catalog/product-search.js";
import { normalizeMpn } from "../catalog-import/normalizer.js";
import { assertValidSettingValues } from "../../lib/settings-validation.js";
import { splitBlanks, withCleared } from "../../lib/blank-fields.js";

const HttpUrl = z.string().url().refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL");

const ProductBody = z.object({
  mpn: z.string().min(1).max(100),
  name: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  manufacturerId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  specifications: z.record(z.string(), z.unknown()).optional(),
  packageType: z.string().max(100).optional(),
  mountingType: z.string().max(100).optional(),
  lifecycleStatus: z.string().max(50).optional(),
  datasheetUrl: HttpUrl.optional(),
  images: z.array(HttpUrl).max(20).optional(),
  isActive: z.boolean().optional(),
  // Owner's Product Master fields -- packaging/uom/productGroup are
  // Settings-backed LOVs, validated below. productCategory reuses the
  // pre-existing categoryId relation above rather than duplicating it as a
  // Settings category.
  productCode: z.string().trim().max(100).optional(),
  spq: z.number().int().nonnegative().max(1_000_000_000).optional(),
  packaging: z.string().trim().max(50).optional(),
  uom: z.string().trim().max(30).optional(),
  hsCode: z.string().trim().max(30).optional(),
  hsDescription: z.string().trim().max(500).optional(),
  productGroup: z.string().trim().max(100).optional(),
  eccn: z.string().trim().max(30).optional(),
  availableStock: z.number().int().nonnegative().max(1_000_000_000).optional(),
});

const PRODUCT_REQUIRED_KEYS = ["mpn"] as const;

async function validateProductRefs(
  body: Partial<z.infer<typeof ProductBody>>,
): Promise<void> {
  await assertValidSettingValues([
    { category: "PACKAGING", value: body.packaging },
    { category: "UOM", value: body.uom },
    { category: "PRODUCT_GROUP", value: body.productGroup },
    { category: "HSN_CODE", value: body.hsCode },
    { category: "SUB_CATEGORY_HS_DESC", value: body.hsDescription },
  ]);
  const [manufacturer, category] = await Promise.all([
    body.manufacturerId ? prisma.manufacturer.findUnique({ where: { id: body.manufacturerId }, select: { id: true } }) : undefined,
    body.categoryId ? prisma.category.findUnique({ where: { id: body.categoryId }, select: { id: true } }) : undefined,
  ]);
  if (body.manufacturerId && !manufacturer) throw Errors.validation("manufacturerId does not reference an existing manufacturer");
  if (body.categoryId && !category) throw Errors.validation("categoryId does not reference an existing category");
}

const ProductListQuery = z.object({
  q: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
  packageType: z.string().max(100).optional(),
  lifecycleStatus: z.string().max(50).optional(),
  importStatus: z.string().max(50).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export async function adminProductsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const query = ProductListQuery.parse(req.query);
    const result = await searchProducts(query);
    return reply.send(paginated(result.data, result.total, query.page, query.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const product = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!product) throw Errors.notFound("Product");
    return reply.send(ok(product));
  });

  // Admin-only commercial history, derived entirely from existing
  // RfqItem/QuotationItem/VendorQuote relations rather than a duplicated
  // history table. Never merged into PRODUCT_INCLUDE above -- that constant
  // is shared with the public product-search route, and this data (RFQ
  // quantities/target prices, sold prices, vendor costs) must never reach a
  // public response.
  app.get("/:id/history", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw Errors.notFound("Product");

    const [rfqRequests, sales] = await Promise.all([
      prisma.rfqItem.findMany({
        where: { productId: id },
        select: {
          id: true, quantity: true, targetPriceUsd: true, status: true, requiredDate: true, createdAt: true,
          rfq: { select: { rfqNumber: true, status: true } },
          vendorQuotes: { select: { id: true, unitCost: true, currency: true, leadTimeDays: true, moq: true, status: true, createdAt: true, vendorRfq: { select: { vendor: { select: { id: true, name: true } } } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.quotationItem.findMany({
        where: { productId: id },
        select: {
          id: true, quantity: true, unitPrice: true, lineTotal: true, createdAt: true,
          quotation: { select: { quotationNumber: true, status: true, currency: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const purchases = rfqRequests.flatMap((r) =>
      r.vendorQuotes.map((vq) => ({
        id: vq.id,
        vendorId: vq.vendorRfq.vendor.id,
        vendorName: vq.vendorRfq.vendor.name,
        unitCost: vq.unitCost,
        currency: vq.currency,
        leadTimeDays: vq.leadTimeDays,
        moq: vq.moq,
        status: vq.status,
        createdAt: vq.createdAt,
      })),
    );

    return reply.send(ok({
      rfqRequests: rfqRequests.map(({ vendorQuotes: _vendorQuotes, ...r }) => r),
      sales,
      purchases,
    }));
  });

  app.post("/", async (req, reply) => {
    const { clean } = splitBlanks(req.body, Object.keys(ProductBody.shape), PRODUCT_REQUIRED_KEYS);
    const body = ProductBody.parse(clean);
    await validateProductRefs(body);
    const normalizedMpn = normalizeMpn(body.mpn);
    // Manufacturer-aware clash check — matches the import pipeline's
    // dedup logic (upsert.ts): the same MPN is only a conflict when it
    // belongs to the same manufacturer (or neither has one on file yet).
    const existing = await prisma.product.findFirst({
      where: { normalizedMpn, manufacturerId: body.manufacturerId ?? null },
    });
    if (existing) throw Errors.conflict("A product with this MPN already exists for this manufacturer");

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: { ...body, normalizedMpn, specifications: body.specifications as Prisma.InputJsonValue | undefined },
        include: PRODUCT_INCLUDE,
      });
      await auditInTx(tx, { userId: req.user!.id, action: "product.created", entityType: "product", entityId: p.id, newValue: p });
      return p;
    });
    return reply.status(201).send(ok(product));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Product");
    const { clean, cleared } = splitBlanks(req.body, Object.keys(ProductBody.shape), PRODUCT_REQUIRED_KEYS);
    const body = ProductBody.partial().parse(clean);
    await validateProductRefs(body);

    const manufacturerCleared = "manufacturerId" in cleared;
    if (body.mpn !== undefined || body.manufacturerId !== undefined || manufacturerCleared) {
      const targetManufacturerId = manufacturerCleared ? null : body.manufacturerId !== undefined ? body.manufacturerId : existing.manufacturerId;
      const clash = await prisma.product.findFirst({
        where: { normalizedMpn: normalizeMpn(body.mpn ?? existing.mpn), manufacturerId: targetManufacturerId ?? null, id: { not: id } },
      });
      if (clash) throw Errors.conflict("A product with this MPN already exists for this manufacturer");
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          ...withCleared(body, cleared),
          ...(body.mpn ? { normalizedMpn: normalizeMpn(body.mpn) } : {}),
          specifications: body.specifications as Prisma.InputJsonValue | undefined,
        },
        include: PRODUCT_INCLUDE,
      });
      await auditInTx(tx, { userId: req.user!.id, action: "product.updated", entityType: "product", entityId: id, oldValue: existing, newValue: p });
      return p;
    });
    return reply.send(ok(product));
  });
}
