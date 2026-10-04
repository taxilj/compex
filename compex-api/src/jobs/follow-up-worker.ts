import { prisma } from "../lib/prisma.js";
import { sendEmail, followUpEmail, emailFailureReason } from "../lib/email.js";

// Database-polled follow-up sender (no Redis -- see follow-up-scheduler.ts).
// Follow-ups are day-granular, so a 15-minute poll is ample.
const POLL_INTERVAL_MS = 15 * 60_000;
const BATCH_SIZE = 25;

export async function processFollowUp(followUpId: string): Promise<void> {
  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
    select: { id: true, status: true, type: true, rfqId: true, leadId: true },
  });

  if (!followUp || followUp.status !== "SCHEDULED") return;
  const rfqId = followUp.rfqId;
  if (!rfqId) {
    await prisma.followUp.update({ where: { id: followUpId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    return;
  }

  // Safety re-check before sending
  const lead = followUp.leadId
    ? await prisma.lead.findUnique({ where: { id: followUp.leadId }, select: { status: true } })
    : null;

  if (lead && (lead.status === "WON" || lead.status === "LOST")) {
    await prisma.followUp.update({
      where: { id: followUpId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return;
  }

  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    select: {
      rfqNumber: true,
      status: true,
      customer: { select: { user: { select: { email: true, firstName: true, lastName: true } } } },
      quotations: { where: { status: { in: ["ACCEPTED", "REJECTED"] } }, select: { id: true } },
    },
  });

  if (!rfq || rfq.status === "CANCELLED" || rfq.quotations.length > 0) {
    await prisma.followUp.update({
      where: { id: followUpId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return;
  }

  const latestQuotation = await prisma.quotation.findFirst({
    where: { rfqId, status: { in: ["SENT", "VIEWED", "DRAFT"] } },
    select: { quotationNumber: true },
    orderBy: { createdAt: "desc" },
  });

  const customerName = `${rfq.customer.user.firstName} ${rfq.customer.user.lastName}`;

  // Atomic claim: only one execution can flip sentAt from null -> now while
  // status is still SCHEDULED. A crash between a successful send and the SENT
  // write leaves sentAt set, so the next poll skips it -- no duplicate email.
  const claim = await prisma.followUp.updateMany({
    where: { id: followUpId, status: "SCHEDULED", sentAt: null },
    data: { sentAt: new Date() },
  });
  if (claim.count === 0) return;

  try {
    await sendEmail({
      to: rfq.customer.user.email,
      subject: `Follow-up: RFQ ${rfq.rfqNumber}`,
      html: followUpEmail(customerName, rfq.rfqNumber, followUp.type, latestQuotation?.quotationNumber),
    });
    await prisma.followUp.update({
      where: { id: followUpId },
      data: { status: "SENT" },
    });
  } catch (err) {
    await prisma.followUp.update({
      where: { id: followUpId },
      data: { status: "FAILED", failureReason: emailFailureReason(err), sentAt: null },
    });
    console.error(`[follow-up] ${followUpId} send failed:`, emailFailureReason(err));
  }
}

// A row claimed (sentAt set) but never marked SENT/FAILED was interrupted mid-send
// (e.g. a deploy). The email may or may not have gone out, so it is surfaced as
// FAILED for staff to review rather than retried into a possible duplicate.
const STALE_CLAIM_MS = 60 * 60_000;
export const INTERRUPTED_FOLLOW_UP_REASON = "Interrupted during send; delivery unknown";

export async function sendDueFollowUps(now = new Date()): Promise<number> {
  await prisma.followUp.updateMany({
    where: { status: "SCHEDULED", sentAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
    data: { status: "FAILED", failureReason: INTERRUPTED_FOLLOW_UP_REASON },
  });
  const due = await prisma.followUp.findMany({
    where: { status: "SCHEDULED", sentAt: null, scheduledAt: { lte: now } },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_SIZE,
  });
  for (const { id } of due) {
    // One bad row must not block every row queued behind it.
    await processFollowUp(id).catch((err: unknown) => {
      console.error(`[follow-up] ${id} could not be processed:`, err instanceof Error ? err.message : "Unknown error");
    });
  }
  return due.length;
}

export function startFollowUpWorker(intervalMs = POLL_INTERVAL_MS) {
  let inFlight: Promise<void> | null = null;
  const tick = () => {
    if (inFlight) return inFlight; // never overlap polls
    inFlight = sendDueFollowUps()
      .then(() => undefined)
      .catch((err: unknown) => {
        console.error("[follow-up] poll failed:", err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  void tick();
  // Shutdown waits for an in-flight send so a deploy does not strand a claimed row.
  return {
    close: async () => {
      clearInterval(timer);
      await inFlight;
    },
  };
}
