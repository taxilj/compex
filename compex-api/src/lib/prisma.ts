import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prisma's own error output can echo the failing call's arguments (customer data), so it is
    // development-only. In production a failed query surfaces as a thrown error, which every
    // handler logs through safeErr/describeError (code only, e.g. P2002).
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;