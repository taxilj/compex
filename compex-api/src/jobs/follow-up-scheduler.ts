import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const FOLLOW_UP_DELAYS_MS: Record<string, number> = {
  DAY_1: 1 * 24 * 60 * 60 * 1000,
  DAY_3: 3 * 24 * 60 * 60 * 1000,
  DAY_7: 7 * 24 * 60 * 60 * 1000,
  DAY_14: 14 * 24 * 60 * 60 * 1000,
};

let followUpQueue: Queue | null = null;

function getQueue(): Queue {
  if (!followUpQueue) {
    followUpQueue = new Queue("follow-ups", {
      connection: { url: env.REDIS_URL },
    });
  }
  return followUpQueue;
}

export async function scheduleFollowUps(rfqId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { rfqId }, select: { id: true } });
  const queue = getQueue();
  const now = Date.now();

  for (const [type, delayMs] of Object.entries(FOLLOW_UP_DELAYS_MS)) {
    const scheduledAt = new Date(now + delayMs);
    const followUp = await prisma.followUp.create({
      data: {
        leadId: lead?.id ?? null,
        rfqId,
        type: type as "DAY_1" | "DAY_3" | "DAY_7" | "DAY_14",
        scheduledAt,
        status: "SCHEDULED",
      },
    });
    await queue.add(
      "send-follow-up",
      { followUpId: followUp.id, rfqId, type },
      { delay: delayMs, jobId: `followup-${followUp.id}` },
    );
  }
}

export async function cancelFollowUps(rfqId: string): Promise<void> {
  const pending = await prisma.followUp.findMany({
    where: { rfqId, status: "SCHEDULED" },
    select: { id: true },
  });

  for (const fu of pending) {
    await prisma.followUp.update({
      where: { id: fu.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    try {
      const queue = getQueue();
      const job = await queue.getJob(`followup-${fu.id}`);
      if (job) await job.remove();
    } catch {
      // Job may have already run — not an error
    }
  }
}
