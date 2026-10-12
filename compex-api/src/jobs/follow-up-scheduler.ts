import { prisma } from "../lib/prisma.js";

// Follow-ups are durable FollowUp rows in Postgres; follow-up-worker.ts polls for
// due rows. They deliberately do not use a Redis delayed queue: BullMQ polls
// Redis every 10s while any delayed job exists, and 14-day follow-ups always
// exist -- that alone cost ~2M Redis commands/month.

const FOLLOW_UP_DELAYS_MS: Record<string, number> = {
  DAY_1: 1 * 24 * 60 * 60 * 1000,
  DAY_3: 3 * 24 * 60 * 60 * 1000,
  DAY_7: 7 * 24 * 60 * 60 * 1000,
  DAY_14: 14 * 24 * 60 * 60 * 1000,
};

export async function scheduleFollowUps(rfqId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { rfqId }, select: { id: true } });
  const now = Date.now();

  for (const [type, delayMs] of Object.entries(FOLLOW_UP_DELAYS_MS)) {
    const followUpType = type as "DAY_1" | "DAY_3" | "DAY_7" | "DAY_14";
    const existing = await prisma.followUp.findUnique({
      where: { rfqId_type: { rfqId, type: followUpType } },
    });
    if (existing) continue;
    await prisma.followUp.create({
      data: {
        leadId: lead?.id ?? null,
        rfqId,
        type: followUpType,
        scheduledAt: new Date(now + delayMs),
        status: "SCHEDULED",
      },
    });
  }
}

export async function cancelFollowUps(rfqId: string): Promise<void> {
  await prisma.followUp.updateMany({
    where: { rfqId, status: "SCHEDULED" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}
