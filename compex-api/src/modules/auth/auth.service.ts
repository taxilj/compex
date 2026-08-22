import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import {
  signAccessToken,
  generateRefreshTokenRaw,
  hashToken,
} from "../../lib/jwt.js";
import { sendEmail, verificationEmail } from "../../lib/email.js";
import { Errors } from "../../lib/errors.js";
import { audit } from "../../lib/audit.js";
import { env } from "../../config/env.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const REFRESH_EXPIRES_DAYS = 30;

function accountNumber(): string {
  return `CX-${Date.now().toString(36).toUpperCase()}`;
}

export async function register(input: RegisterInput, ipAddress?: string) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Errors.conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const verifyToken = crypto.randomBytes(32).toString("hex");

  const user = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.companyName,
        gstin: input.gstin,
        city: input.city,
      },
    });

    const newUser = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      },
    });

    await tx.customer.create({
      data: {
        userId: newUser.id,
        companyId: company.id,
        accountNumber: accountNumber(),
      },
    });

    await tx.emailVerification.create({
      data: {
        userId: newUser.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return newUser;
  });

  audit({ userId: user.id, action: "auth.register", ipAddress });

  // Fire-and-forget email — not awaited so registration doesn't fail on email errors
  sendEmail({
    to: input.email,
    subject: "Verify your Compex Solution account",
    html: verificationEmail(verifyToken, env.CORS_ORIGIN),
  }).catch(console.error);

  return { message: "Registration successful. Please verify your email." };
}

export async function login(input: LoginInput, ipAddress?: string) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { customer: true },
  });

  // Constant-time check even if user doesn't exist
  const dummyHash = "$2b$12$invaliddummyhashfortimingnormalization";
  await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);

  // Rate-limit check: count recent failed attempts for this email
  const recentFailures = await prisma.auditLog.count({
    where: {
      action: "auth.login.failed",
      newValue: { path: ["email"], equals: input.email },
      createdAt: { gte: new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000) },
    },
  });

  if (recentFailures >= MAX_FAILED_ATTEMPTS) {
    throw Errors.rateLimited();
  }

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    audit({
      action: "auth.login.failed",
      newValue: { email: input.email },
      ipAddress,
    });
    // Same message for wrong email or wrong password — prevents enumeration
    throw Errors.unauthorized();
  }

  if (user.status === "PENDING_VERIFICATION") {
    throw Errors.unprocessable("Please verify your email before logging in");
  }
  if (user.status === "SUSPENDED") {
    throw Errors.unprocessable("Your account has been suspended");
  }

  const tokenPayload = {
    sub: user.id,
    role: user.role,
    customerId: user.customer?.id,
    companyId: user.customer?.companyId,
  };

  const accessToken = signAccessToken(tokenPayload);
  const rawRefresh = generateRefreshTokenRaw();
  const family = crypto.randomUUID();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawRefresh),
      family,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  audit({ userId: user.id, action: "auth.login", ipAddress });

  return {
    accessToken,
    refreshToken: rawRefresh,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };
}

export async function refresh(rawToken: string, ipAddress?: string) {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt) {
    // Token reuse detected — revoke entire family
    if (stored?.family) {
      await prisma.refreshToken.updateMany({
        where: { family: stored.family },
        data: { revokedAt: new Date() },
      });
    }
    throw Errors.unauthorized();
  }

  if (stored.expiresAt < new Date()) throw Errors.unauthorized();

  // Rotate: revoke old, issue new
  const newRaw = generateRefreshTokenRaw();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: hashToken(newRaw),
        family: stored.family,
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: stored.userId },
    include: { customer: true },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    customerId: user.customer?.id,
    companyId: user.customer?.companyId,
  });

  audit({ userId: user.id, action: "auth.token_refresh", ipAddress });
  return { accessToken, refreshToken: newRaw };
}

export async function logout(rawToken: string, userId: string) {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (stored) {
    // Revoke entire family on logout
    await prisma.refreshToken.updateMany({
      where: { family: stored.family },
      data: { revokedAt: new Date() },
    });
  }
  audit({ userId, action: "auth.logout" });
}

export async function verifyEmail(token: string) {
  const record = await prisma.emailVerification.findUnique({ where: { token } });
  if (!record || record.verifiedAt) throw Errors.notFound("Verification token");
  if (record.expiresAt < new Date()) throw Errors.unprocessable("Verification token expired");

  await prisma.$transaction([
    prisma.emailVerification.update({
      where: { id: record.id },
      data: { verifiedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { status: "ACTIVE" },
    }),
  ]);

  return { message: "Email verified. You can now log in." };
}