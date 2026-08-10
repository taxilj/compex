import type { FastifyRequest, FastifyReply } from "fastify";
import { Errors } from "../lib/errors.js";

export function requireRole(...roles: string[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user || !roles.includes(request.user.role)) {
      throw Errors.forbidden();
    }
  };
}