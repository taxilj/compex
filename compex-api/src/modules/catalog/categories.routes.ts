import type { FastifyInstance } from "fastify";
import { ok } from "../../lib/response.js";
import { prisma } from "../../lib/prisma.js";

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  // Return the complete real taxonomy in one response. Prisma's relation
  // include only supports a fixed depth, while Category is recursive; load
  // the flat set once and build the tree from the actual parent IDs so a
  // third (or deeper) level cannot disappear from public navigation.
  app.get("/", async (_req, reply) => {
    const rows = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    });

    type CategoryNode = (typeof rows)[number] & { children: CategoryNode[] };
    const byId = new Map<string, CategoryNode>(rows.map((row) => [row.id, { ...row, children: [] }]));
    const roots: CategoryNode[] = [];

    for (const row of rows) {
      const node = byId.get(row.id)!;
      const parent = row.parentId ? byId.get(row.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    return reply.send(ok(roots));
  });
}
