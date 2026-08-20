import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

const VendorBody = z.object({
  name: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export async function adminVendorsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const q = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(50) }).parse(req.query);
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.vendor.findMany({ skip, take: q.limit, orderBy: { name: "asc" } }),
      prisma.vendor.count(),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw Errors.notFound("Vendor");
    return reply.send(ok(vendor));
  });

  app.post("/", async (req, reply) => {
    const vendor = await prisma.vendor.create({ data: VendorBody.parse(req.body) });
    return reply.status(201).send(ok(vendor));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Vendor");
    const vendor = await prisma.vendor.update({ where: { id }, data: VendorBody.partial().parse(req.body) });
    return reply.send(ok(vendor));
  });
}
