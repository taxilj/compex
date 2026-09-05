import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../lib/audit.js";
import { SOURCING_STATUSES, allowedNextSourcingStatuses, type SourcingStatus } from "../rfqs/sourcing-state-machine.js";

const RFQ_ADMIN_SELECT = {
  id: true,
  rfqNumber: true,
  status: true,
  sourcingStatus: true,
  priority: true,
  deliveryLocation: true,
  requiredDate: true,
  additionalNotes: true,
  internalNotes: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      accountNumber: true,
      company: { select: { id: true, name: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  },
  _count: { select: { items: true } },
} as const;

export async function adminRfqsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const query = z
      .object({
        status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SOURCING", "CANCELLED"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
      })
      .parse(req.query);

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };
    const skip = (query.page - 1) * query.limit;

    const [data, total] = await prisma.$transaction([
      prisma.rfq.findMany({
        where,
        select: RFQ_ADMIN_SELECT,
        skip,
        take: query.limit,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      }),
      prisma.rfq.count({ where }),
    ]);

    return reply.send(paginated(data, total, query.page, query.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const rfq = await prisma.rfq.findUnique({
      where: { id },
      select: { ...RFQ_ADMIN_SELECT, items: true, documents: true },
    });
    if (!rfq) throw Errors.notFound("RFQ");
    return reply.send(ok(rfq));
  });

  app.patch("/:id/status", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { status, internalNotes } = z
      .object({
        status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SOURCING", "CANCELLED"]),
        internalNotes: z.string().max(2000).optional(),
      })
      .parse(req.body);

    const existing = await prisma.rfq.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound("RFQ");

    const ALLOWED: Record<string, string[]> = {
      DRAFT: ["SUBMITTED", "CANCELLED"],
      SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
      UNDER_REVIEW: ["SOURCING", "CANCELLED"],
      SOURCING: ["CANCELLED"],
      CANCELLED: [],
    };
    if (!ALLOWED[existing.status]?.includes(status)) {
      throw Errors.unprocessable(`Cannot transition RFQ from ${existing.status} to ${status}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rfq = await tx.rfq.update({
        where: { id },
        data: { status, ...(internalNotes !== undefined ? { internalNotes } : {}) },
        select: RFQ_ADMIN_SELECT,
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "rfq.status_changed",
          entityType: "rfq",
          entityId: id,
          oldValue: { status: existing.status },
          newValue: { status },
        },
      });
      return rfq;
    });

    return reply.send(ok(updated));
  });

  app.patch("/:id/sourcing-status", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { sourcingStatus } = z.object({ sourcingStatus: z.enum(SOURCING_STATUSES) }).parse(req.body);
    const existing = await prisma.rfq.findUnique({ where: { id }, select: { sourcingStatus: true } });
    if (!existing) throw Errors.notFound("RFQ");

    const allowed = allowedNextSourcingStatuses(existing.sourcingStatus as SourcingStatus | null);
    if (!allowed.includes(sourcingStatus)) {
      throw Errors.unprocessable(`Cannot transition sourcing workflow from ${existing.sourcingStatus ?? "UNINITIALIZED"} to ${sourcingStatus}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rfq = await tx.rfq.update({ where: { id }, data: { sourcingStatus }, select: RFQ_ADMIN_SELECT });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "rfq.sourcing_status_changed",
          entityType: "rfq",
          entityId: id,
          oldValue: { sourcingStatus: existing.sourcingStatus },
          newValue: { sourcingStatus },
        },
      });
      return rfq;
    });

    return reply.send(ok(updated));
  });
}
