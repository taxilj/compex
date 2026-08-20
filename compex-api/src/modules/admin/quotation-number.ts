import { prisma } from "../../lib/prisma.js";

export async function generateQuotationNumber(): Promise<string> {
  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('quotation_counter_seq')
  `;
  const seq = result[0].nextval;
  const year = new Date().getFullYear();
  const padded = String(seq).padStart(6, "0");
  return `QUO-${year}-${padded}`;
}
