import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken } from "../lib/jwt.js";
import { Errors } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { AuthUser, JwtPayload } from "../types/index.js";

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  const cookieToken = request.cookies?.access_token;
  const raw = header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;

  if (!raw) throw Errors.unauthorized();

  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(raw);
  } catch {
    throw Errors.unauthorized();
  }

  // The token only proves who signed in up to 15 minutes ago. Suspending or
  // demoting a user must take effect on their next request, so status and role
  // come from the database, never from the token.
  // ponytail: one PK read per authenticated request; add a short TTL cache only if load shows it matters.
  const current = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { role: true, status: true },
  });
  if (!current || current.status !== "ACTIVE") throw Errors.unauthorized();

  request.user = {
    id: payload.sub,
    role: current.role,
    customerId: payload.customerId,
    companyId: payload.companyId,
  } satisfies AuthUser;
}