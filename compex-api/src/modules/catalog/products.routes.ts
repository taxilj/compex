import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { PRODUCT_INCLUDE, searchProducts } from "./product-search.js";
import { anyPrimaryConfigured, searchMpnAcrossProviders } from "./mpn-search-orchestrator.js";
import { toPublicProduct } from "./public-dto.js";
import { resolveUnknownMpn } from "./product-on-demand.js";
import { normalizeMpn } from "../catalog-import/normalizer.js";
import { PUBLIC_CACHE_CONTROL, bumpCatalogVersion, cachedCatalog, catalogKey } from "./catalog-cache.js";

const ProductListQuery = z.object({
  q: z.string().max(200).optional(),
  categoryId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
  packageType: z.string().max(100).optional(),
  lifecycleStatus: z.string().max(50).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(24),
});

const ProductDetailQuery = z.object({
  manufacturerId: z.string().uuid().optional(),
});

const ProductMpnParams = z.object({
  mpn: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9 ._+/#-]+$/, "MPN contains invalid characters"),
});

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  // Multi-supplier exact-MPN search (Mouser + DigiKey + element14 primary,
  // provider lookup -- see mpn-search-orchestrator.ts). Always
  // 200s on a successful search, even with no result or a partial provider
  // outage: `sources` tells the frontend which providers found the part /
  // failed / were rate-limited / timed out, so it can render a non-blocking
  // "some sources are temporarily unavailable" notice instead of a false
  // "this part doesn't exist". Only a bad request or total misconfiguration
  // (no provider credentials at all) is an error response.
  app.get("/lookup", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { mpn } = z.object({ mpn: z.string() }).parse(req.query);
    if (!anyPrimaryConfigured()) {
      return reply.status(503).send({
        success: false,
        error: { code: "SEARCH_NOT_CONFIGURED", message: "Live product lookup is not configured." },
      });
    }

    try {
      const result = await searchMpnAcrossProviders(mpn);
      return reply.send(ok(result));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "VALIDATION_ERROR") throw error;
      throw Errors.serviceUnavailable("Live product lookup is temporarily unavailable. Please try again later.");
    }
  });

  // Public catalogue DTOs are mapped through toPublicProduct() (Phase 10
  // privacy fix) -- never send the raw Prisma row, which carries
  // source/sourceUrl/sourceProductId/importStatus/dataHash/normalizedMpn and
  // unfiltered specifications.
  app.get("/", async (req, reply) => {
    const query = ProductListQuery.parse(req.query);
    const result = await cachedCatalog(catalogKey("products", query), async () => {
      const { data, total } = await searchProducts({ ...query, isActive: true, lean: true });
      // Lean rows omit `specifications`; the DTO filter treats that as empty.
      return { data: data.map((row) => toPublicProduct(row as Parameters<typeof toPublicProduct>[0])), total };
    });
    reply.header("Cache-Control", PUBLIC_CACHE_CONTROL);
    return reply.send(paginated(result.data, result.total, query.page, query.limit));
  });

  app.get("/:mpn", async (req, reply) => {
    const { mpn } = ProductMpnParams.parse(req.params);
    const { manufacturerId } = ProductDetailQuery.parse(req.query);
    // Match on normalizedMpn (the same key upsertProduct() persists and
    // matches by) rather than raw mpn -- a raw case-insensitive match misses
    // a product stored under a differently-punctuated MPN spelling (e.g.
    // "ABC-123" vs "ABC 123"), which would otherwise defeat this fast path.
    const where = { normalizedMpn: normalizeMpn(mpn), isActive: true, ...(manufacturerId ? { manufacturerId } : {}) };
    const products = await prisma.product.findMany({ where, include: PRODUCT_INCLUDE, take: manufacturerId ? 1 : 2 });
    if (products.length === 0) throw Errors.notFound("Product");
    if (products.length > 1) {
      throw Errors.conflict("More than one manufacturer has this MPN. Select the manufacturer before opening the product.");
    }
    const [product] = products;
    return reply.send(ok(toPublicProduct(product)));
  });

  // Database-first product detail (GET /:mpn above) is the fast path for
  // every already-catalogued product. This is the controlled fallback for a
  // genuine cache/database miss only -- the frontend calls it after a 404
  // from GET /:mpn, never unconditionally. It fans out to the same
  // catalog-import pipeline used by the STAFF/ADMIN single-MPN routes
  // (bounded per-provider timeout, one failure never blocks the others,
  // concurrent requests for the same MPN are deduplicated) and persists any
  // real match into the actual Product/ProductSource tables, so the next
  // visitor for this MPN hits the fast database path instead of triggering
  // another live lookup.
  app.post("/:mpn/resolve", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { mpn } = ProductMpnParams.parse(req.params);
    const { manufacturerId } = ProductDetailQuery.parse(req.query);
    const result = await resolveUnknownMpn(mpn, manufacturerId);
    // sources is empty when the product was already catalogued: nothing changed.
    if (result.product && result.sources.length > 0) await bumpCatalogVersion();
    return reply.send(ok(result));
  });
}
