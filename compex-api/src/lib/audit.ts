import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { describeError } from "./safe-log.js";

interface AuditParams {
  userId?: string;
  customerId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

// Audit history has a wider retention/reader surface than the admin API, so
// financial and credential material is dropped here for every caller instead of
// relying on each route to remember (vendors/customers also strip it locally).
const SENSITIVE_AUDIT_KEYS = new Set([
  "bankdetails", "bankname", "bankaccount", "bankaddress", "swiftifscmicr", "routingcode",
  "creditlimit", "shippingaccount", "internalaccountnumber", "passwordhash", "tokenhash",
]);
const MAX_REDACT_DEPTH = 10;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Returns a new structure (never mutates the caller's row). Only arrays and plain
// objects are walked; Dates, Prisma Decimals and other class instances pass through.
export function redactAuditValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACT_DEPTH) return undefined; // total function: a cyclic value cannot throw into the caller
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(item, depth + 1));
  if (!isPlainObject(value)) return value;
  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_AUDIT_KEYS.has(key.toLowerCase())) continue;
    redacted[key] = redactAuditValue(entry, depth + 1);
  }
  return redacted;
}

function auditData(params: AuditParams) {
  return {
    userId: params.userId,
    customerId: params.customerId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValue: params.oldValue ? (redactAuditValue(params.oldValue) as object) : undefined,
    newValue: params.newValue ? (redactAuditValue(params.newValue) as object) : undefined,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  };
}

// Fire-and-forget — audit failures never block business logic
export function audit(params: AuditParams): void {
  prisma.auditLog
    .create({ data: auditData(params) })
    .catch((err: unknown) => console.error(`[audit] write failed: ${describeError(err)}`));
}

// Runs inside an existing transaction — if the audit write fails, the whole
// transaction rolls back. Use for mutations where "succeeded but untraced"
// is not acceptable (vendor cost, quotation state, RFQ status).
export async function auditInTx(tx: Prisma.TransactionClient, params: AuditParams): Promise<void> {
  await tx.auditLog.create({ data: auditData(params) });
}