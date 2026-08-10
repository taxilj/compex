import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../lib/jwt.js";
import { Errors } from "../lib/errors.js";
import type { AuthUser } from "../types/index.js";

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  const cookieToken = request.cookies?.access_token;
  const raw = header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;

  if (!raw) throw Errors.unauthorized();

  try {
    const payload = verifyAccessToken(raw);
    request.user = {
      id: payload.sub,
      role: payload.role,
      customerId: payload.customerId,
      companyId: payload.companyId,
    } satisfies AuthUser;
  } catch {
    throw Errors.unauthorized();
  }
}