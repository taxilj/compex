import { Queue } from "bullmq";
import IORedis from "ioredis";
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
    // Producer connection: bounded retries/timeout so a Redis outage fails a
    // single enqueue attempt quickly instead of hammering Redis with an
    // unbounded reconnect/retry loop in the background. Mirrors the BOM
    // upload queue's producer connection (workers still legitimately use
    // maxRetriesPerRequest: null for blocking commands).
    const connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy: () => null,
    });
    followUpQueue = new Queue("follow-ups", { connection });
  }
  return followUpQueue;
}

export async function scheduleFollowUps(rfqId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { rfqId }, select: { id: true } });
  const queue = getQueue();
  const now = Date.now();

  for (const [type, delayMs] of Object.entries(FOLLOW_UP_DELAYS_MS)) {
    const followUpType = type as "DAY_1" | "DAY_3" | "DAY_7" | "DAY_14";
    const existing = await prisma.followUp.findUnique({
      where: { rfqId_type: { rfqId, type: followUpType } },
    });
    if (existing) continue;
    const scheduledAt = new Date(now + delayMs);
    const followUp = await prisma.followUp.create({
      data: {
        leadId: lead?.id ?? null,
        rfqId,
        type: followUpType,
        scheduledAt,
        status: "SCHEDULED",
      },
    });
    try {
      await queue.add(
        "send-follow-up",
        { followUpId: followUp.id, rfqId, type },
        { delay: delayMs, jobId: `followup-${followUp.id}` },
      );
    } catch (err) {
      // Enqueue failed (e.g. Redis unreachable): the FollowUp row would be
      // stuck "SCHEDULED" forever with no job behind it, so roll it back
      // instead of leaving a phantom record, log, and keep trying the
      // remaining follow-up types rather than aborting the whole batch.
      console.error(`[FOLLOWUP] Enqueue failed for ${followUpType} on RFQ ${rfqId}:`, err);
      await prisma.followUp.delete({ where: { id: followUp.id } }).catch(() => {});
    }
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
