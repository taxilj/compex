import type { FastifyInstance } from "fastify";
import { ok } from "../../lib/response.js";
import { prisma } from "../../lib/prisma.js";

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  // Hierarchical list: top-level categories with their subcategories nested.
  app.get("/", async (_req, reply) => {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: "asc" },
      include: {
        children: { orderBy: { name: "asc" } },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    return reply.send(ok(categories));
  });
}
