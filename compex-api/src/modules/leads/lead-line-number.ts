import type { Prisma } from "@prisma/client";

// Mirrors rfqs/rfq-line-number.ts: a PostgreSQL transaction advisory lock
// serializes line allocation for one lead without blocking unrelated leads.
export async function nextLeadItemLineNumber(
  tx: Prisma.TransactionClient,
  leadId: string,
): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`compex-lead-line:${leadId}`}))`;
  const aggregate = await tx.leadItem.aggregate({
    where: { leadId },
    _max: { lineNumber: true },
  });
  return (aggregate._max.lineNumber ?? 0) + 1;
}
