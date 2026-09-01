import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RegisterSchema, LoginSchema, CompleteAccountSetupSchema } from "./auth.schema.js";
import * as authService from "./auth.service.js";
import { authenticate } from "../../middleware/authenticate.js";
import { ok } from "../../lib/response.js";
import { env, isProd } from "../../config/env.js";

const REFRESH_COOKIE = "refresh_token";
const ACCESS_COOKIE = "access_token";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  // The Next.js same-origin rewrite makes cross-site cookies unnecessary.
  sameSite: "lax" as const,
  path: "/",
};

// The integration suite legitimately registers/logs in far more than a real
// attacker-facing limit allows within a minute (e.g. many test cases in one
// file share the same app instance and IP). Keep the low, real limits for
// every other environment and only relax them under NODE_ENV=test.
const REGISTER_RATE_LIMIT = env.NODE_ENV === "test" ? 1000 : 5;
const LOGIN_RATE_LIMIT = env.NODE_ENV === "test" ? 1000 : 10;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", { config: { rateLimit: { max: REGISTER_RATE_LIMIT, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = RegisterSchema.parse(req.body);
    const result = await authService.register(body, req.ip);
    return reply.status(201).send(ok(result));
  });

  app.post("/login", { config: { rateLimit: { max: LOGIN_RATE_LIMIT, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const result = await authService.login(body, req.ip);

    reply
      .setCookie(ACCESS_COOKIE, result.accessToken, { ...COOKIE_OPTS, maxAge: 900 })
      .setCookie(REFRESH_COOKIE, result.refreshToken, {
        ...COOKIE_OPTS,
        maxAge: 30 * 24 * 60 * 60,
        path: "/api/v1/auth",
      });

    // Never send refreshToken in JSON body
    const { refreshToken: _omit, ...safeResult } = result;
    return reply.send(ok(safeResult));
  });

  app.post("/refresh", async (req, reply) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) {
      return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "No refresh token" } });
    }
    const result = await authService.refresh(raw, req.ip);
    reply
      .setCookie(ACCESS_COOKIE, result.accessToken, { ...COOKIE_OPTS, maxAge: 900 })
      .setCookie(REFRESH_COOKIE, result.refreshToken, {
        ...COOKIE_OPTS,
        maxAge: 30 * 24 * 60 * 60,
        path: "/api/v1/auth",
      });
    return reply.send(ok({ accessToken: result.accessToken }));
  });

  app.post("/logout", { preHandler: authenticate }, async (req, reply) => {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw && req.user) await authService.logout(raw, req.user.id);
    reply
      .clearCookie(ACCESS_COOKIE)
      .clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    return reply.send(ok({ message: "Logged out" }));
  });

  app.get("/me", { preHandler: authenticate }, async (req, reply) => {
    const { id, role, customerId, companyId } = req.user!;
    return reply.send(ok({ id, role, customerId, companyId }));
  });

  app.post("/verify-email", async (req, reply) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const result = await authService.verifyEmail(token);
    return reply.send(ok(result));
  });

  app.post("/complete-account-setup", async (req, reply) => {
    const body = CompleteAccountSetupSchema.parse(req.body);
    const result = await authService.completeAccountSetup(body, req.ip);
    return reply.send(ok(result));
  });
}
