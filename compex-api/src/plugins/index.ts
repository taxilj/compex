import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export async function registerPlugins(app: FastifyInstance): Promise<void> {
  await app.register(sensible);

  await app.register(helmet, {
    contentSecurityPolicy: false, // configured at reverse proxy level
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
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    // Fastify validation errors (e.g. from schema)
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: error.message },
      });
    }
    // Rate limit error from @fastify/rate-limit
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      });
    }
    // Never expose raw DB or stack errors in production
    const isDev = env.NODE_ENV === "development";
    app.log.error(error);
    return reply.status(500).send({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: isDev ? error.message : "Internal server error",
      },
    });
  });
}