import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

const ManufacturerBody = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
});

export async function adminManufacturersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const q = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(50) }).parse(req.query);
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.manufacturer.findMany({ skip, take: q.limit, orderBy: { name: "asc" } }),
      prisma.manufacturer.count(),
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
    const mfr = await prisma.manufacturer.create({ data: ManufacturerBody.parse(req.body) });
    return reply.status(201).send(ok(mfr));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.manufacturer.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Manufacturer");
    const mfr = await prisma.manufacturer.update({ where: { id }, data: ManufacturerBody.partial().parse(req.body) });
    return reply.send(ok(mfr));
  });
}
