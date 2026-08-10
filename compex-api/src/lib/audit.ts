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

// Fire-and-forget — audit failures never block business logic
export function audit(params: AuditParams): void {
  prisma.auditLog
    .create({
      data: {
        userId: params.userId,
        customerId: params.customerId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue ? (params.oldValue as object) : undefined,
        newValue: params.newValue ? (params.newValue as object) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
    .catch((err: unknown) => console.error("[audit] write failed:", err));
}