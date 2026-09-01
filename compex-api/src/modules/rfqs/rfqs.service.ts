import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { Errors } from "../../lib/errors.js";
import { audit } from "../../lib/audit.js";
import { env } from "../../config/env.js";
import { nextRfqNumber } from "./rfq-number.js";
import { nextRfqItemLineNumber } from "./rfq-line-number.js";
import { sendEmail, rfqConfirmationEmail, websiteEnquiryEmail } from "../../lib/email.js";
import { scheduleFollowUps } from "../../jobs/follow-up-scheduler.js";
import { adminLeadUrl, safeNotificationError } from "../leads/website-enquiries.service.js";
import type {
  CreateRfqInput,
  UpdateRfqInput,
  CreateRfqItemInput,
  UpdateRfqItemInput,
  RfqListQuery,
} from "./rfqs.schema.js";

const RFQ_SELECT = {
  id: true,
  rfqNumber: true,
  status: true,
  priority: true,
  deliveryLocation: true,
  requiredDate: true,
  additionalNotes: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  customerId: true,
  _count: { select: { items: true } },
} as const;

// Verify ownership — returns 404 to prevent ID enumeration
async function assertOwnership(rfqId: string, customerId: string) {
  const rfq = await prisma.rfq.findUnique({ where: { id: rfqId } });
  if (!rfq || rfq.customerId !== customerId) throw Errors.notFound("RFQ");
  return rfq;
}

export async function createRfq(customerId: string, userId: string, input: CreateRfqInput) {
  const rfqNumber = await nextRfqNumber();

  const rfq = await prisma.rfq.create({
    data: {
      rfqNumber,
      customerId,
      deliveryLocation: input.deliveryLocation,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
      priority: input.priority,
      additionalNotes: input.additionalNotes,
    },
    select: RFQ_SELECT,
  });

  audit({
    userId,
    customerId,
    action: "rfq.created",
    entityType: "rfq",
    entityId: rfq.id,
    newValue: { rfqNumber: rfq.rfqNumber },
  });

  return rfq;
}

export async function listRfqs(customerId: string, query: RfqListQuery) {
  const { status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = { customerId, ...(status ? { status } : {}) };
  const [data, total] = await prisma.$transaction([
    prisma.rfq.findMany({ where, select: RFQ_SELECT, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.rfq.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getRfq(rfqId: string, customerId: string) {
  const rfq = await prisma.rfq.findUnique({
    where: { id: rfqId },
    select: { ...RFQ_SELECT, items: true },
  });
  if (!rfq || rfq.customerId !== customerId) throw Errors.notFound("RFQ");
  return rfq;
}

export async function updateRfq(
  rfqId: string,
  customerId: string,
  userId: string,
  input: UpdateRfqInput,
) {
  const existing = await assertOwnership(rfqId, customerId);
  if (existing.status !== "DRAFT") {
    throw Errors.unprocessable("Only DRAFT RFQs can be edited");
  }

  const updated = await prisma.rfq.update({
    where: { id: rfqId },
    data: {
      deliveryLocation: input.deliveryLocation,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
      priority: input.priority,
      additionalNotes: input.additionalNotes,
    },
    select: RFQ_SELECT,
  });

  audit({ userId, customerId, action: "rfq.updated", entityType: "rfq", entityId: rfqId });
  return updated;
}

export async function submitRfq(rfqId: string, customerId: string, userId: string) {
  const existing = await assertOwnership(rfqId, customerId);
  if (existing.status !== "DRAFT") {
    throw Errors.unprocessable("Only DRAFT RFQs can be submitted");
  }

  const itemCount = await prisma.rfqItem.count({ where: { rfqId } });
  if (itemCount === 0) {
    throw Errors.unprocessable("Add at least one item before submitting");
  }

  // Fetch customer details for lead + email (before transaction)
  const customerRecord = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      user: { select: { email: true, firstName: true, lastName: true, phone: true } },
      company: { select: { name: true } },
    },
  });
  if (!customerRecord) throw Errors.notFound("Customer");

  let leadId = "";
  const updated = await prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.update({
      where: { id: rfqId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      select: { ...RFQ_SELECT, deliveryLocation: true },
    });
    await tx.auditLog.create({
      data: {
        userId,
        customerId,
        action: "rfq.submitted",
        entityType: "rfq",
        entityId: rfqId,
        oldValue: { status: "DRAFT" },
        newValue: { status: "SUBMITTED" },
      },
    });
    // Create lead if not already linked to this RFQ
    const lead = await tx.lead.upsert({
      where: { rfqId },
      update: {},
      create: {
        customerId,
        rfqId,
        contactName: `${customerRecord.user.firstName} ${customerRecord.user.lastName}`,
        contactEmail: customerRecord.user.email,
        contactPhone: customerRecord.user.phone ?? null,
        companyName: customerRecord.company.name,
        source: "DIRECT",
        status: "NEW",
        notificationStatus: "PENDING",
      },
      select: { id: true, notificationStatus: true },
    });
    leadId = lead.id;
    return rfq;
  });

  // Email + follow-ups: fire-and-forget, never roll back the RFQ
  sendEmail({
    to: customerRecord.user.email,
    subject: `RFQ Received — ${updated.rfqNumber}`,
    html: rfqConfirmationEmail(
      `${customerRecord.user.firstName} ${customerRecord.user.lastName}`,
      updated.rfqNumber,
      itemCount,
      updated.deliveryLocation,
    ),
  }).catch((err) => console.error("[EMAIL] RFQ confirmation failed:", err));

  // Sales notification: same never-lose-the-record pattern as the public enquiry form —
  // the RFQ/Lead is already committed above, so an email failure only marks the Lead FAILED.
  notifySalesOfRfq(leadId, rfqId, customerRecord, updated.rfqNumber, updated.deliveryLocation)
    .catch((err) => console.error("[EMAIL] Sales notification failed:", err));

  scheduleFollowUps(rfqId).catch((err) => console.error("[FOLLOWUP] Schedule failed:", err));

  return updated;
}

async function notifySalesOfRfq(
  leadId: string,
  rfqId: string,
  customerRecord: { user: { email: string; firstName: string; lastName: string; phone: string | null }; company: { name: string } },
  rfqNumber: string,
  deliveryLocation: string | null,
): Promise<void> {
  const items = await prisma.rfqItem.findMany({
    where: { rfqId },
    select: { mpn: true, manufacturer: true, description: true, quantity: true },
    orderBy: { lineNumber: "asc" },
  });
  try {
    const delivery = await sendEmail({
      to: env.ENQUIRY_NOTIFICATION_TO,
      replyTo: customerRecord.user.email,
      subject: `New RFQ — ${rfqNumber}`,
      html: websiteEnquiryEmail({
        referenceNumber: rfqNumber,
        source: "REQUEST_QUOTE",
        submittedAt: new Date().toISOString(),
        contactName: `${customerRecord.user.firstName} ${customerRecord.user.lastName}`,
        companyName: customerRecord.company.name,
        contactEmail: customerRecord.user.email,
        contactPhone: customerRecord.user.phone ?? undefined,
        message: "Submitted via the customer portal RFQ wizard.",
        deliveryLocation: deliveryLocation ?? undefined,
        items,
        adminUrl: adminLeadUrl(),
      }),
    });
    await prisma.lead.update({
      where: { id: leadId },
      data: { notificationStatus: "SENT", notificationSentAt: new Date(), notificationMessageId: delivery.messageId ?? undefined, notificationError: null },
    });
  } catch (error) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { notificationStatus: "FAILED", notificationError: safeNotificationError(error) },
    }).catch((updateError) => console.error("[rfq-notify] notification status update failed", updateError));
  }
}

export async function addItem(
  rfqId: string,
  customerId: string,
  userId: string,
  input: CreateRfqItemInput,
) {
  const rfq = await assertOwnership(rfqId, customerId);
  if (rfq.status !== "DRAFT") throw Errors.unprocessable("Items can only be added to DRAFT RFQs");

  return prisma.$transaction(async (tx) => {
    const lineNumber = await nextRfqItemLineNumber(tx, rfqId);
    return tx.rfqItem.create({
      data: {
        rfqId,
        lineNumber,
        mpn: input.mpn,
        manufacturer: input.manufacturer,
        description: input.description,
        quantity: input.quantity,
        targetPriceUsd: input.targetPriceUsd != null ? new Decimal(input.targetPriceUsd) : undefined,
        requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
        notes: input.notes,
      },
    });
  });
}

export async function updateItem(
  rfqId: string,
  itemId: string,
  customerId: string,
  input: UpdateRfqItemInput,
) {
  const rfq = await assertOwnership(rfqId, customerId);
  if (rfq.status !== "DRAFT") throw Errors.unprocessable("Items can only be edited on DRAFT RFQs");

  const item = await prisma.rfqItem.findFirst({ where: { id: itemId, rfqId } });
  if (!item) throw Errors.notFound("RFQ item");

  return prisma.rfqItem.update({
    where: { id: itemId },
    data: {
      mpn: input.mpn,
      manufacturer: input.manufacturer,
      description: input.description,
      quantity: input.quantity,
      targetPriceUsd: input.targetPriceUsd != null ? new Decimal(input.targetPriceUsd) : undefined,
      requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
      notes: input.notes,
    },
  });
}

export async function deleteItem(rfqId: string, itemId: string, customerId: string) {
  const rfq = await assertOwnership(rfqId, customerId);
  if (rfq.status !== "DRAFT") throw Errors.unprocessable("Items can only be removed from DRAFT RFQs");

  const item = await prisma.rfqItem.findFirst({ where: { id: itemId, rfqId } });
  if (!item) throw Errors.notFound("RFQ item");

  await prisma.rfqItem.delete({ where: { id: itemId } });
}
