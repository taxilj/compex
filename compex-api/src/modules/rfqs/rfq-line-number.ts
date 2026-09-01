import type { Prisma } from "@prisma/client";

// PostgreSQL transaction advisory locks serialize line allocation for one RFQ
// without blocking line creation on unrelated RFQs.
export async function nextRfqItemLineNumber(
  tx: Prisma.TransactionClient,
  rfqId: string,
): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`compex-rfq-line:${rfqId}`}))`;
  const aggregate = await tx.rfqItem.aggregate({
    where: { rfqId },
    _max: { lineNumber: true },
  });
  return (aggregate._max.lineNumber ?? 0) + 1;
}
