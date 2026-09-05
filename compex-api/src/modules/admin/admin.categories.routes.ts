import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { auditInTx } from "../../lib/audit.js";

const CategoryBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  parentId: z.string().uuid().optional(),
});

// Walk up the parent chain to reject a parentId that would create a cycle
// (a category cannot become its own ancestor).
async function assertNotDescendant(categoryId: string, candidateParentId: string): Promise<void> {
  let cursor: string | null = candidateParentId;
  while (cursor) {
    if (cursor === categoryId) throw Errors.validation("A category cannot be its own ancestor");
    const parent: { parentId: string | null } | null = await prisma.category.findUnique({ where: { id: cursor }, select: { parentId: true } });
    cursor = parent?.parentId ?? null;
  }
}

export async function adminCategoriesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (_req, reply) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { parent: true, _count: { select: { products: true, children: true } } },
    });
    return reply.send(ok(categories));
  });

  app.post("/", async (req, reply) => {
    const body = CategoryBody.parse(req.body);
    if (body.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) throw Errors.notFound("Parent category");
    }
    const category = await prisma.$transaction(async (tx) => {
      const c = await tx.category.create({ data: body });
      await auditInTx(tx, { userId: req.user!.id, action: "category.created", entityType: "category", entityId: c.id, newValue: c });
      return c;
    });
    return reply.status(201).send(ok(category));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Category");
    const body = CategoryBody.partial().parse(req.body);

    if (body.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: body.parentId } });
      if (!parent) throw Errors.notFound("Parent category");
      await assertNotDescendant(id, body.parentId);
    }

    const category = await prisma.$transaction(async (tx) => {
      const c = await tx.category.update({ where: { id }, data: body });
      await auditInTx(tx, { userId: req.user!.id, action: "category.updated", entityType: "category", entityId: id, oldValue: existing, newValue: c });
      return c;
    });
    return reply.send(ok(category));
  });
}
