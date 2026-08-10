import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { Errors } from "../../lib/errors.js";
import { ok } from "../../lib/response.js";
import * as customersService from "./customers.service.js";
import { UpdateCompanySchema } from "./customers.schema.js";

export async function customersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("CUSTOMER"));

  app.get("/me", async (req, reply) => {
    const user = await customersService.getMe(req.user!.id);
    return reply.send(ok(user));
  });

  app.get("/me/company", async (req, reply) => {
    if (!req.user!.companyId) throw Errors.notFound("Company");
    const company = await customersService.getMyCompany(req.user!.companyId);
    return reply.send(ok(company));
  });

  app.patch("/me/company", async (req, reply) => {
    if (!req.user!.companyId) throw Errors.notFound("Company");
    const body = UpdateCompanySchema.parse(req.body);
    const updated = await customersService.updateMyCompany(
      req.user!.companyId,
      req.user!.id,
      body,
    );
    return reply.send(ok(updated));
  });
}