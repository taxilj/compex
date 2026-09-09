import type { FastifyInstance } from "fastify";
import path from "node:path";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { createCsvFetcher } from "./fetchers/csv-fetcher.js";
import { createMouserFetcher } from "./fetchers/mouser-fetcher.js";
import { createElement14Fetcher } from "./fetchers/element14-fetcher.js";
import { createDigiKeyFetcher } from "./fetchers/digikey-fetcher.js";
import { runImport } from "./run-import.js";
import { PRODUCT_INCLUDE } from "../catalog/product-search.js";

// Same allowlist/size-cap approach as bom-upload.ts.
const ALLOWED_EXTS = new Set([".csv", ".xlsx"]);
const ALLOWED_MIMES = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function adminCatalogImportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.post("/csv", async (req, reply) => {
    const data = await req.file();
    if (!data) throw Errors.validation("No file uploaded");

    const ext = path.extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) throw Errors.validation("Only .csv and .xlsx files are allowed");

    const mime = data.mimetype.split(";")[0].trim();
    if (!ALLOWED_MIMES.has(mime) && mime !== "application/octet-stream") throw Errors.validation("Invalid file type");

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_BYTES) throw Errors.validation("File exceeds 10 MB limit");
    if (ext === ".xlsx" && (buffer[0] !== 0x50 || buffer[1] !== 0x4b)) {
      throw Errors.validation("File does not appear to be a valid XLSX file");
    }

    const fetcher = createCsvFetcher(buffer, ext as ".csv" | ".xlsx");
    const run = await prisma.catalogImportRun.create({ data: { source: fetcher.source } });

    // Small admin-curated files only — runs inline rather than through a new
    // BullMQ job type. If import volume grows, move this behind the worker
    // infrastructure already used for BOM processing (bom-processor.ts).
    await runImport(fetcher, run.id);

    const result = await prisma.catalogImportRun.findUnique({ where: { id: run.id } });
    return reply.status(201).send(ok(result));
  });

  // Single-MPN lookup against a live source (Phase 2, step 8) — reuses the
  // same run-import pipeline as the CSV fetcher, so it gets the same
  // idempotent-upsert/hash-skip/CatalogImportRun tracking for free.
  app.post("/mouser/:mpn", async (req, reply) => {
    const { mpn } = z.object({ mpn: z.string().trim().min(1).max(100) }).parse(req.params);
    const fetcher = createMouserFetcher(mpn);
    const run = await prisma.catalogImportRun.create({ data: { source: fetcher.source } });

    try {
      const importResult = await runImport(fetcher, run.id);
      const result = await prisma.catalogImportRun.findUnique({ where: { id: run.id } });
      const products = await prisma.product.findMany({ where: { id: { in: importResult.productIds } }, include: PRODUCT_INCLUDE });
      return reply.status(201).send(ok({ run: result, product: products.length === 1 ? products[0] : null, products }));
    } catch {
      // runImport already persisted status=FAILED + errorLog on the run —
      // surface that to the caller instead of a bare 500.
      const failed = await prisma.catalogImportRun.findUnique({ where: { id: run.id } });
      return reply.status(502).send(ok({ run: failed, product: null }));
    }

  });

  app.post("/element14/:mpn", async (req, reply) => {
    const { mpn } = z.object({ mpn: z.string().trim().min(1).max(100) }).parse(req.params);
    const fetcher = createElement14Fetcher(mpn);
    const run = await prisma.catalogImportRun.create({ data: { source: fetcher.source } });

    try {
      const importResult = await runImport(fetcher, run.id);
      const result = await prisma.catalogImportRun.findUnique({ where: { id: run.id } });
      const products = await prisma.product.findMany({ where: { id: { in: importResult.productIds } }, include: PRODUCT_INCLUDE });
      return reply.status(201).send(ok({ run: result, product: products.length === 1 ? products[0] : null, products }));
    } catch {
      const failed = await prisma.catalogImportRun.findUnique({ where: { id: run.id } });
      return reply.status(502).send(ok({ run: failed, product: null }));
    }

  });

  app.post("/digikey/:mpn", async (req, reply) => {
    const { mpn } = z.object({ mpn: z.string().trim().min(1).max(100) }).parse(req.params);
    const fetcher = createDigiKeyFetcher(mpn);
    const run = await prisma.catalogImportRun.create({ data: { source: fetcher.source } });

    try {
      const importResult = await runImport(fetcher, run.id);
      const result = await prisma.catalogImportRun.findUnique({ where: { id: run.id } });
      const products = await prisma.product.findMany({ where: { id: { in: importResult.productIds } }, include: PRODUCT_INCLUDE });
      return reply.status(201).send(ok({ run: result, product: products.length === 1 ? products[0] : null, products }));
    } catch {
      const failed = await prisma.catalogImportRun.findUnique({ where: { id: run.id } });
      return reply.status(502).send(ok({ run: failed, product: null }));
    }

  });

  app.get("/runs", async (req, reply) => {
    const q = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20) }).parse(req.query);
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.catalogImportRun.findMany({ skip, take: q.limit, orderBy: { startedAt: "desc" } }),
      prisma.catalogImportRun.count(),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  // Internal catalog data-quality snapshot — STAFF/ADMIN only (this route's
  // preHandler hooks above apply here too). Every figure is a live count over
  // the real Product/Manufacturer/Category/ProductSource/CatalogImportRun
  // tables; nothing here is invented or cached from a prior redesign.
  app.get("/coverage", async (_req, reply) => {
    const [
      totalProducts,
      totalManufacturers,
      totalCategories,
      productsMissingCategory,
      productsMissingManufacturer,
      productsMissingImage,
      productsMissingDatasheet,
      manufacturerBreakdown,
      categoryBreakdown,
      sourceBreakdown,
      lastRun,
      recentFailedRuns,
    ] = await prisma.$transaction([
      prisma.product.count(),
      prisma.manufacturer.count(),
      prisma.category.count(),
      prisma.product.count({ where: { categoryId: null } }),
      prisma.product.count({ where: { manufacturerId: null } }),
      prisma.product.count({ where: { images: { isEmpty: true } } }),
      prisma.product.count({ where: { datasheetUrl: null } }),
      prisma.manufacturer.findMany({
        select: { id: true, name: true, _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        select: { id: true, name: true, _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.productSource.groupBy({ by: ["source"], _count: true, orderBy: { source: "asc" } }),
      prisma.catalogImportRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: { source: true, status: true, startedAt: true, completedAt: true, itemsProcessed: true, itemsCreated: true, itemsUpdated: true, itemsFailed: true },
      }),
      prisma.catalogImportRun.findMany({
        where: { OR: [{ status: "FAILED" }, { itemsFailed: { gt: 0 } }] },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: { source: true, status: true, startedAt: true, itemsFailed: true, errorLog: true },
      }),
    ]);

    return reply.send(ok({
      totals: { products: totalProducts, manufacturers: totalManufacturers, categories: totalCategories },
      dataQuality: {
        productsMissingCategory,
        productsMissingManufacturer,
        productsMissingImage,
        productsWithImage: totalProducts - productsMissingImage,
        productsMissingDatasheet,
        productsWithDatasheet: totalProducts - productsMissingDatasheet,
      },
      byManufacturer: manufacturerBreakdown.map((m) => ({ id: m.id, name: m.name, productCount: m._count.products })),
      byCategory: categoryBreakdown.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products })),
      productSourceCoverage: sourceBreakdown.map((s) => ({ source: s.source, count: s._count })),
      lastImportRun: lastRun,
      recentImportErrors: recentFailedRuns,
    }));
  });
}
