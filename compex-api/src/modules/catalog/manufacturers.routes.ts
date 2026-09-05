import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export async function manufacturersRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req, reply) => {
    const q = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(100) }).parse(req.query);
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.manufacturer.findMany({
        skip,
        take: q.limit,
        orderBy: { name: "asc" },
        include: { _count: { select: { products: { where: { isActive: true } } } } },
      }),
      prisma.manufacturer.count(),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:slug", async (req, reply) => {
    const { slug } = z.object({ slug: z.string().min(1).max(100) }).parse(req.params);
    const manufacturer = await prisma.manufacturer.findUnique({ where: { slug } });
    if (!manufacturer) throw Errors.notFound("Manufacturer");

    const q = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(24) }).parse(req.query);
    const skip = (q.page - 1) * q.limit;
    const where = { manufacturerId: manufacturer.id, isActive: true };
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({ where, skip, take: q.limit, orderBy: { mpn: "asc" }, include: { category: true } }),
      prisma.product.count({ where }),
    ]);
    return reply.send(ok({ manufacturer, products: { data: products, meta: { total, page: q.page, limit: q.limit } } }));
  });
}
