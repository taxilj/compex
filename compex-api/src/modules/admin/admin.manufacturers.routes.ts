import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { auditInTx } from "../../lib/audit.js";

const ManufacturerBody = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  description: z.string().max(2000).optional(),
  country: z.string().max(100).optional(),
  source: z.string().max(50).optional(),
  sourceUrl: z.string().url().optional(),
  distributorLink: z.string().trim().url().max(500).optional(),
  stockCheckLink: z.string().trim().url().max(500).optional(),
  acquiredMfr: z.string().trim().max(500).optional(),
  remarks: z.string().trim().max(2000).optional(),
  suffixInformation: z.string().trim().max(1000).optional(),
});

export async function adminManufacturersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const q = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(50),
      search: z.string().trim().max(200).optional(),
    }).parse(req.query);
    const where = q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {};
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.manufacturer.findMany({ where, skip, take: q.limit, orderBy: { name: "asc" } }),
      prisma.manufacturer.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const mfr = await prisma.manufacturer.findUnique({ where: { id } });
    if (!mfr) throw Errors.notFound("Manufacturer");
    return reply.send(ok(mfr));
  });

  app.post("/", async (req, reply) => {
    const mfr = await prisma.$transaction(async (tx) => {
      const m = await tx.manufacturer.create({ data: ManufacturerBody.parse(req.body) });
      await auditInTx(tx, { userId: req.user!.id, action: "manufacturer.created", entityType: "manufacturer", entityId: m.id, newValue: m });
      return m;
    });
    return reply.status(201).send(ok(mfr));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.manufacturer.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Manufacturer");
    const mfr = await prisma.$transaction(async (tx) => {
      const m = await tx.manufacturer.update({ where: { id }, data: ManufacturerBody.partial().parse(req.body) });
      await auditInTx(tx, { userId: req.user!.id, action: "manufacturer.updated", entityType: "manufacturer", entityId: id, oldValue: existing, newValue: m });
      return m;
    });
    return reply.send(ok(mfr));
  });

  app.post("/:id/deactivate", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.manufacturer.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Manufacturer");
    const mfr = await prisma.$transaction(async (tx) => {
      const m = await tx.manufacturer.update({ where: { id }, data: { isActive: false } });
      await auditInTx(tx, { userId: req.user!.id, action: "manufacturer.deactivated", entityType: "manufacturer", entityId: id });
      return m;
    });
    return reply.send(ok(mfr));
  });

  app.post("/:id/activate", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.manufacturer.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Manufacturer");
    const mfr = await prisma.$transaction(async (tx) => {
      const m = await tx.manufacturer.update({ where: { id }, data: { isActive: true } });
      await auditInTx(tx, { userId: req.user!.id, action: "manufacturer.activated", entityType: "manufacturer", entityId: id });
      return m;
    });
    return reply.send(ok(mfr));
  });
}
