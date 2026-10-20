import { env } from "../config/env.js";
import { withTimeout } from "../lib/async.js";
import { describeEmailError, sendEmailWithRetry, websiteEnquiryEmail } from "../lib/email.js";
import { prisma } from "../lib/prisma.js";
import { describeError } from "../lib/safe-log.js";
import { adminLeadUrl, safeNotificationError } from "../modules/leads/website-enquiries.service.js";

// The sales-mailbox notification for a website enquiry or portal RFQ is sent right after
// the lead is saved. When that send fails the lead stays FAILED -- this sweep re-sends it
// so an enquiry cannot sit unseen. Postgres is the only dependency (no Redis commands),
// the same approach as bom-recovery.
//
// Every update bumps leads.updated_at, so "updated more than RETRY_AFTER ago" is both the
// back-off between attempts and the detector for a PENDING lead stranded by a crash.
// Attempts are counted from the audit log, which avoids a schema change.
const POLL_INTERVAL_MS = 10 * 60_000;
const RETRY_AFTER_MS = 10 * 60_000;
const MAX_AGE_MS = 3 * 24 * 60 * 60_000; // older failures are left for staff, never auto-sent
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;
const SEND_BUDGET_MS = 45_000;
const RETRY_ACTION = "lead.notification_retry";
const PORTAL_MESSAGE = "Submitted via the customer portal RFQ wizard.";

const ITEM_SELECT = { mpn: true, manufacturer: true, description: true, quantity: true } as const;
const LEAD_SELECT = {
  id: true,
  referenceNumber: true,
  source: true,
  notificationStatus: true,
  updatedAt: true,
  createdAt: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  companyName: true,
  subject: true,
  notes: true,
  deliveryLocation: true,
  requiredDate: true,
  items: { select: ITEM_SELECT, orderBy: { lineNumber: "asc" } },
  rfq: { select: { rfqNumber: true, deliveryLocation: true, items: { select: ITEM_SELECT, orderBy: { lineNumber: "asc" } } } },
} as const;

type EmailSource = "CONTACT" | "REQUEST_QUOTE" | "BOM";

// Same wording as the original senders (website-enquiries.service.ts, rfqs.service.ts).
function subjectFor(source: EmailSource, reference: string): string {
  if (source === "CONTACT") return `New Website Enquiry — ${reference}`;
  if (source === "BOM") return `New BOM Enquiry — ${reference}`;
  return `New RFQ — ${reference}`;
}

function buildEmail(lead: Awaited<ReturnType<typeof findDueLeads>>[number]) {
  const reference = lead.referenceNumber ?? lead.rfq?.rfqNumber ?? lead.id;
  const source: EmailSource = lead.source === "CONTACT" || lead.source === "BOM" ? lead.source : "REQUEST_QUOTE";
  return {
    to: env.ENQUIRY_NOTIFICATION_TO,
    replyTo: lead.contactEmail,
    idempotencyKey: `enquiry-notify/${lead.id}`,
    subject: subjectFor(source, reference),
    html: websiteEnquiryEmail({
      referenceNumber: reference,
      source,
      submittedAt: lead.createdAt.toISOString(),
      contactName: lead.contactName,
      companyName: lead.companyName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone ?? undefined,
      subject: lead.subject ?? undefined,
      message: lead.notes ?? PORTAL_MESSAGE,
      deliveryLocation: lead.deliveryLocation ?? lead.rfq?.deliveryLocation ?? undefined,
      requiredDate: lead.requiredDate?.toISOString().slice(0, 10),
      items: lead.items.length ? lead.items : (lead.rfq?.items ?? []),
      adminUrl: adminLeadUrl(),
    }),
  };
}

function findDueLeads(now: Date) {
  return prisma.lead.findMany({
    where: {
      notificationStatus: { in: ["FAILED", "PENDING"] },
      updatedAt: { lt: new Date(now.getTime() - RETRY_AFTER_MS) },
      createdAt: { gt: new Date(now.getTime() - MAX_AGE_MS) },
    },
    select: LEAD_SELECT,
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });
}

async function retryNotification(lead: Awaited<ReturnType<typeof findDueLeads>>[number]): Promise<boolean> {
  const previous = await prisma.auditLog.count({ where: { action: RETRY_ACTION, entityType: "lead", entityId: lead.id } });
  if (previous >= MAX_ATTEMPTS) return false;

  // Optimistic claim: only one instance wins, e.g. while an old and a new deploy overlap.
  const claim = await prisma.lead.updateMany({
    where: { id: lead.id, notificationStatus: lead.notificationStatus, updatedAt: lead.updatedAt },
    data: { notificationStatus: "PENDING" },
  });
  if (claim.count !== 1) return false;

  const attempt = previous + 1;
  await prisma.auditLog.create({
    data: { action: RETRY_ACTION, entityType: "lead", entityId: lead.id, newValue: { attempt } },
  });

  try {
    const delivery = await withTimeout(sendEmailWithRetry(buildEmail(lead)), SEND_BUDGET_MS, "Enquiry notification retry");
    await prisma.lead.update({
      where: { id: lead.id },
      data: { notificationStatus: "SENT", notificationSentAt: new Date(), notificationMessageId: delivery.messageId ?? undefined, notificationError: null },
    });
    return true;
  } catch (error) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { notificationStatus: "FAILED", notificationError: safeNotificationError(error) },
    }).catch((updateError: unknown) => console.error(`[notification-recovery] status update failed: ${describeError(updateError)}`));
    console.error(JSON.stringify({
      event: attempt >= MAX_ATTEMPTS ? "enquiry_notification_retry_exhausted" : "enquiry_notification_retry_failed",
      referenceNumber: lead.referenceNumber,
      attempt,
      timestamp: new Date().toISOString(),
      ...describeEmailError(error),
    }));
    return false;
  }
}

export async function recoverFailedNotifications(now = new Date()): Promise<number> {
  const due = await findDueLeads(now);
  let sent = 0;
  for (const lead of due) {
    try {
      if (await retryNotification(lead)) sent += 1;
    } catch (error) {
      // One bad lead must not block the rest of the batch.
      console.error(`[notification-recovery] lead ${lead.id} skipped: ${describeError(error)}`);
    }
  }
  return sent;
}

export function startNotificationRecovery(intervalMs = POLL_INTERVAL_MS) {
  let inFlight: Promise<void> | null = null;
  const tick = () => {
    if (inFlight) return inFlight; // never overlap sweeps
    inFlight = recoverFailedNotifications()
      .then(() => undefined)
      .catch((err: unknown) => {
        console.error(`[notification-recovery] sweep failed: ${describeError(err)}`);
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  void tick();
  return {
    close: async () => {
      clearInterval(timer);
      await inFlight;
    },
  };
}
