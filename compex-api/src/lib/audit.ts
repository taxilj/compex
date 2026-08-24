import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

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

function auditData(params: AuditParams) {
  return {
    userId: params.userId,
    customerId: params.customerId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValue: params.oldValue ? (params.oldValue as object) : undefined,
    newValue: params.newValue ? (params.newValue as object) : undefined,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  };
}

// Fire-and-forget — audit failures never block business logic
export function audit(params: AuditParams): void {
  prisma.auditLog
    .create({ data: auditData(params) })
    .catch((err: unknown) => console.error("[audit] write failed:", err));
}

// Runs inside an existing transaction — if the audit write fails, the whole
// transaction rolls back. Use for mutations where "succeeded but untraced"
// is not acceptable (vendor cost, quotation state, RFQ status).
export async function auditInTx(tx: Prisma.TransactionClient, params: AuditParams): Promise<void> {
  await tx.auditLog.create({ data: auditData(params) });
}