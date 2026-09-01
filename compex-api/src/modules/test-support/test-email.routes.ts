import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { env } from "../../config/env.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";

// This module is registered only when NODE_ENV=test. It is intentionally not
// reachable in development or production, and still requires STAFF/ADMIN.
export async function testEmailRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  app.get("/email-outbox", async (_req, reply) => {
    if (env.NODE_ENV !== "test") throw Errors.notFound("Resource");
    const emails = await prisma.testEmail.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return reply.send(ok(emails));
  });
}
