import { prisma } from "../../lib/prisma.js";

export async function nextVendorRfqNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('vendor_rfq_counter_seq') AS nextval
  `;
  const seq = String(rows[0].nextval).padStart(5, "0");
  return `VRFQ-${year}-${seq}`;
}
