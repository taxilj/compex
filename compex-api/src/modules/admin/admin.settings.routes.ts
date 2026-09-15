import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { auditInTx } from "../../lib/audit.js";

const SettingBody = z.object({
  category: z.string().min(1).max(100),
  value: z.string().min(1).max(200),
  sortOrder: z.number().int().default(0),
  isEditable: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export async function adminSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  // Dropdown consumers (SettingsSelect) call this with no query and get only
  // active values -- a deactivated option never appears as a new choice. The
  // Settings management page itself passes includeInactive=true so an admin
  // can see (and reactivate) retired values.
  app.get("/", async (req, reply) => {
    const q = z.object({ category: z.string().max(100).optional(), includeInactive: z.coerce.boolean().default(false) }).parse(req.query);
    const settings = await prisma.setting.findMany({
      where: { ...(q.category ? { category: q.category } : {}), ...(q.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { value: "asc" }],
    });
    return reply.send(ok(settings));
  });

  app.get("/categories", async (_req, reply) => {
    const rows = await prisma.setting.findMany({ select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } });
    return reply.send(ok(rows.map((r) => r.category)));
  });

  app.post("/", async (req, reply) => {
    const body = SettingBody.parse(req.body);
    const existing = await prisma.setting.findUnique({ where: { category_value: { category: body.category, value: body.value } } });
    if (existing) throw Errors.conflict("This value already exists for this category");
    const setting = await prisma.$transaction(async (tx) => {
      const s = await tx.setting.create({ data: body });
      await auditInTx(tx, { userId: req.user!.id, action: "setting.created", entityType: "setting", entityId: s.id, newValue: s });
      return s;
    });
    return reply.status(201).send(ok(setting));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.setting.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Setting");
    if (!existing.isEditable) throw Errors.unprocessable("This setting value is read-only and cannot be edited");

    const body = SettingBody.partial().parse(req.body);
    const setting = await prisma.$transaction(async (tx) => {
      const s = await tx.setting.update({ where: { id }, data: body });
      await auditInTx(tx, { userId: req.user!.id, action: "setting.updated", entityType: "setting", entityId: id, oldValue: existing, newValue: s });
      return s;
    });
    return reply.send(ok(setting));
  });

  // Deactivate/reactivate bypass the isEditable lock: retiring a value never
  // mutates its category/value/sortOrder, so it's safe even for
  // system-seeded rows that PATCH otherwise protects from editing. Existing
  // records that already reference a deactivated value are unaffected --
  // only assertValidSettingValue (write-time validation on other routes)
  // treats it as unavailable for new/updated records.
  app.post("/:id/deactivate", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.setting.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Setting");
    const setting = await prisma.$transaction(async (tx) => {
      const s = await tx.setting.update({ where: { id }, data: { isActive: false } });
      await auditInTx(tx, { userId: req.user!.id, action: "setting.deactivated", entityType: "setting", entityId: id, oldValue: existing, newValue: s });
      return s;
    });
    return reply.send(ok(setting));
  });

  app.post("/:id/activate", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.setting.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Setting");
    const setting = await prisma.$transaction(async (tx) => {
      const s = await tx.setting.update({ where: { id }, data: { isActive: true } });
      await auditInTx(tx, { userId: req.user!.id, action: "setting.activated", entityType: "setting", entityId: id, oldValue: existing, newValue: s });
      return s;
    });
    return reply.send(ok(setting));
  });

  app.delete("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.setting.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("Setting");
    if (!existing.isEditable) throw Errors.unprocessable("This setting value is read-only and cannot be deleted");

    await prisma.$transaction(async (tx) => {
      await tx.setting.delete({ where: { id } });
      await auditInTx(tx, { userId: req.user!.id, action: "setting.deleted", entityType: "setting", entityId: id, oldValue: existing });
    });
    return reply.status(204).send();
  });
}
