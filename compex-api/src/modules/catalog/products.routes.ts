import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { PRODUCT_INCLUDE, searchProducts } from "./product-search.js";
import { anyPrimaryOrFallbackConfigured, searchMpnAcrossProviders } from "./mpn-search-orchestrator.js";

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

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  // Multi-supplier exact-MPN search (Mouser + DigiKey + element14 primary,
  // Nexar Supply fallback-only -- see mpn-search-orchestrator.ts). Always
  // 200s on a successful search, even with no result or a partial provider
  // outage: `sources` tells the frontend which providers found the part /
  // failed / were rate-limited / timed out, so it can render a non-blocking
  // "some sources are temporarily unavailable" notice instead of a false
  // "this part doesn't exist". Only a bad request or total misconfiguration
  // (no provider credentials at all) is an error response.
  app.get("/lookup", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { mpn } = z.object({ mpn: z.string() }).parse(req.query);
    if (!anyPrimaryOrFallbackConfigured()) {
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

  app.get("/", async (req, reply) => {
    const query = ProductListQuery.parse(req.query);
    const result = await searchProducts({ ...query, isActive: true });
    return reply.send(paginated(result.data, result.total, query.page, query.limit));
  });

  app.get("/:mpn", async (req, reply) => {
    const { mpn } = z.object({ mpn: z.string().min(1).max(100) }).parse(req.params);
    const { manufacturerId } = ProductDetailQuery.parse(req.query);
    const where = { mpn: { equals: mpn, mode: "insensitive" as const }, isActive: true, ...(manufacturerId ? { manufacturerId } : {}) };
    const products = await prisma.product.findMany({ where, include: PRODUCT_INCLUDE, take: manufacturerId ? 1 : 2 });
    if (products.length === 0) throw Errors.notFound("Product");
    if (products.length > 1) {
      throw Errors.conflict("More than one manufacturer has this MPN. Select the manufacturer before opening the product.");
    }
    const [product] = products;
    return reply.send(ok(product));
  });
}
