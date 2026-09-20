import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { auditInTx } from "../../lib/audit.js";
import { accountSetupEmail, sendEmail } from "../../lib/email.js";
import { env } from "../../config/env.js";
import { hashToken } from "../../lib/jwt.js";
import { assertValidSettingValues } from "../../lib/settings-validation.js";
import { splitBlanks, withCleared } from "../../lib/blank-fields.js";

// Never selects passwordHash -- this shape is reused for list/get/create/
// update responses and audit oldValue/newValue snapshots alike, so leaving
// it out here means it can never leak through any of those paths.
const UserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  firstName: true,
  lastName: true,
  screenName: true,
  organizationId: true,
  position: true,
  department: true,
  mobile: true,
  phone: true,
  address: true,
  skype: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, companyName: true, shortName: true } },
} as const;

const CreateUserBody = z.object({
  email: z.string().trim().email().toLowerCase(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]).default("STAFF"),
  screenName: z.string().trim().max(100).optional(),
  organizationId: z.string().uuid().nullable().optional(),
  position: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  mobile: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional(),
  skype: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(2_000).optional(),
});

// Role is intentionally excluded from updates by regular PATCH -- promoting
// someone to ADMIN is exactly the kind of change that deserves a distinct,
// obviously-audited action rather than riding in on an unrelated profile
// edit. status is restricted to ACTIVE/SUSPENDED: PENDING_VERIFICATION is
// system-set at invite time, never something an admin assigns by hand.
const UpdateUserBody = CreateUserBody.omit({ role: true }).partial().extend({
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

const REQUIRED_KEYS = ["email", "firstName", "lastName", "role", "status"] as const;

async function validateUserRefs(
  body: { position?: string; department?: string; organizationId?: string | null },
): Promise<void> {
  await assertValidSettingValues([
    { category: "POSITION", value: body.position },
    { category: "DEPARTMENT", value: body.department },
  ]);
  if (body.organizationId) {
    const exists = await prisma.organization.findUnique({ where: { id: body.organizationId }, select: { id: true } });
    if (!exists) throw Errors.validation("organizationId does not reference an existing organization");
  }
}

export async function adminUsersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/", async (req, reply) => {
    const q = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(50),
      search: z.string().trim().max(200).optional(),
      role: z.enum(["CUSTOMER", "STAFF", "ADMIN"]).optional(),
    }).parse(req.query);
    const where = {
      ...(q.role ? { role: q.role } : {}),
      ...(q.search ? {
        OR: [
          { email: { contains: q.search, mode: "insensitive" as const } },
          { firstName: { contains: q.search, mode: "insensitive" as const } },
          { lastName: { contains: q.search, mode: "insensitive" as const } },
        ],
      } : {}),
    };
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({ where, select: UserSelect, orderBy: { createdAt: "desc" }, skip, take: q.limit }),
      prisma.user.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const user = await prisma.user.findUnique({ where: { id }, select: UserSelect });
    if (!user) throw Errors.notFound("User");
    return reply.send(ok(user));
  });

  app.post("/", async (req, reply) => {
    const { clean } = splitBlanks(req.body, Object.keys(CreateUserBody.shape), REQUIRED_KEYS);
    const body = CreateUserBody.parse(clean);
    // A STAFF caller can invite STAFF/CUSTOMER accounts but not ADMIN --
    // creating an ADMIN is a privilege grant and must itself come from an
    // existing ADMIN, the same boundary PATCH already enforces by omitting
    // role entirely from UpdateUserBody.
    if (body.role === "ADMIN" && req.user!.role !== "ADMIN") throw Errors.forbidden();
    await validateUserRefs(body);
    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
    if (existing) throw Errors.conflict("An account with this email already exists");

    const setupToken = crypto.randomBytes(32).toString("hex");
    const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { ...body, passwordHash: unusablePasswordHash, status: "PENDING_VERIFICATION" },
        select: UserSelect,
      });
      await tx.accountSetupToken.create({ data: { userId: created.id, tokenHash: hashToken(setupToken), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      await auditInTx(tx, { userId: req.user!.id, action: "user.invited", entityType: "user", entityId: created.id, newValue: created });
      return created;
    });

    try {
      const actionUrl = `${env.CORS_ORIGIN}/setup-account?token=${encodeURIComponent(setupToken)}`;
      await sendEmail({ to: body.email, subject: "Set up your Compex Solution account", html: accountSetupEmail(setupToken, env.CORS_ORIGIN), testActionUrl: actionUrl });
    } catch (sendErr) {
      req.log.error({ err: sendErr, userId: user.id }, "account invitation email failed; rolling back invited user");
      try {
        await prisma.$transaction([
          prisma.accountSetupToken.deleteMany({ where: { userId: user.id } }),
          prisma.user.delete({ where: { id: user.id } }),
          // "user.invited" was committed with the user; record that the invite did not stick.
          prisma.auditLog.create({ data: { userId: req.user!.id, action: "user.invite_failed", entityType: "user", entityId: user.id } }),
        ]);
      } catch (rollbackErr) {
        // Never let a failed rollback replace the real error; surface it to operators instead.
        req.log.error({ err: rollbackErr, userId: user.id }, "rollback of invited user FAILED; orphaned PENDING_VERIFICATION user needs manual cleanup");
      }
      throw Errors.serviceUnavailable("Account invitation could not be delivered. Check the email provider configuration and try again.");
    }

    return reply.status(201).send(ok(user));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.user.findUnique({ where: { id }, select: UserSelect });
    if (!existing) throw Errors.notFound("User");
    // A STAFF caller must not edit an ADMIN account: changing an admin's
    // email (then resetting the password) or suspending them is the same
    // privilege boundary as creating an ADMIN.
    if (existing.role === "ADMIN" && req.user!.role !== "ADMIN") throw Errors.forbidden();
    const { clean, cleared } = splitBlanks(req.body, Object.keys(UpdateUserBody.shape), REQUIRED_KEYS);
    const body = UpdateUserBody.parse(clean);
    await validateUserRefs(body);
    if (body.email && body.email !== existing.email) {
      const emailOwner = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
      if (emailOwner && emailOwner.id !== id) throw Errors.conflict("An account with this email already exists");
    }
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data: withCleared(body, cleared), select: UserSelect });
      await auditInTx(tx, { userId: req.user!.id, action: "user.updated", entityType: "user", entityId: id, oldValue: existing, newValue: updated });
      return updated;
    });
    return reply.send(ok(user));
  });
}
