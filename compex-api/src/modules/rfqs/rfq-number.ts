import { prisma } from "../../lib/prisma.js";

// Uses a PostgreSQL sequence — atomically safe under concurrent requests
export async function nextRfqNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('rfq_counter_seq') AS nextval
  `;
  const seq = String(rows[0].nextval).padStart(6, "0");
  return `RFQ-${year}-${seq}`;
}