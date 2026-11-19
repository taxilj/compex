import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError, Errors } from "../lib/errors.js";
import { safeErr } from "../lib/safe-log.js";

export async function registerPlugins(app: FastifyInstance): Promise<void> {
  await app.register(sensible);

  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], baseUri: ["'none'"], frameAncestors: ["'none'"], formAction: ["'none'"] } },
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.user?.id ?? req.ip,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
    },
  });

  // Centralized error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    // Zod validation errors thrown by manual .parse() calls in routes
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.issues.map((i) => ({ path: i.path, message: i.message })),
        },
      });
    }
    const fastifyError = error as { validation?: unknown; statusCode?: number; message?: string };
    // JSON/body parser errors can happen before the BOM handler runs. Preserve
    // safe client error semantics without exposing the parser's raw message.
    const isBomUpload = request.method === "POST" && /^\/api\/v1\/(?:leads|rfqs)\/[^/]+\/bom\/?$/.test(request.routeOptions.url ?? "");
    if (isBomUpload && fastifyError.statusCode === 413) {
      const failure = Errors.fileTooLarge();
      return reply.status(413).send({ success: false, error: { code: failure.code, message: failure.message } });
    }
    if (isBomUpload && [400, 406, 415].includes(fastifyError.statusCode ?? 0)) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid BOM upload request" } });
    }
    // Fastify validation errors (e.g. from schema)
    if (fastifyError.validation) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: fastifyError.message ?? "Invalid request" },
      });
    }
    // Rate limit error from @fastify/rate-limit
    if (fastifyError.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      });
    }
    // Never expose raw DB or stack errors in production
    const isDev = env.NODE_ENV === "development";
    app.log.error({ ...safeErr(error), method: request.method, route: request.routeOptions?.url }, "unhandled request error");
    return reply.status(500).send({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: isDev ? (fastifyError.message ?? "Internal server error") : "Internal server error",
      },
    });
  });
}
