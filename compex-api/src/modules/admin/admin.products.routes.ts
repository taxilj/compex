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
});

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

  app.post("/", async (req, reply) => {
    const body = ProductBody.parse(req.body);
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
    const body = ProductBody.partial().parse(req.body);

    if (body.mpn !== undefined || body.manufacturerId !== undefined) {
      const targetManufacturerId = body.manufacturerId !== undefined ? body.manufacturerId : existing.manufacturerId;
      const clash = await prisma.product.findFirst({
        where: { normalizedMpn: normalizeMpn(body.mpn ?? existing.mpn), manufacturerId: targetManufacturerId ?? null, id: { not: id } },
      });
      if (clash) throw Errors.conflict("A product with this MPN already exists for this manufacturer");
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          ...body,
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
