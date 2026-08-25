import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { auditInTx } from "../../lib/audit.js";
import { sendEmail, websiteEnquiryEmail } from "../../lib/email.js";
import { prisma } from "../../lib/prisma.js";

const SOURCE_VALUES = ["CONTACT", "REQUEST_QUOTE", "BOM"] as const;

export const WebsiteEnquirySchema = z.object({
  source: z.enum(SOURCE_VALUES),
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  contactPhone: z.string().trim().regex(/^[0-9+().\-\s]{7,30}$/).optional(),
  companyName: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
  deliveryLocation: z.string().trim().max(200).optional(),
  requiredDate: z.string().date().optional(),
  items: z.array(z.object({
    mpn: z.string().trim().min(1).max(100),
    manufacturer: z.string().trim().max(200).optional(),
    description: z.string().trim().max(500).optional(),
    quantity: z.number().int().positive().max(10_000_000),
  })).max(100).default([]),
  website: z.string().max(0).optional(), // Honeypot: real browsers leave this blank.
}).superRefine((value, context) => {
  if (value.source === "REQUEST_QUOTE" && value.items.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "At least one component is required for a quote enquiry" });
  }
});

export type WebsiteEnquiryInput = z.infer<typeof WebsiteEnquirySchema>;

const WEBSITE_LEAD_SELECT = {
  id: true,
  referenceNumber: true,
  source: true,
  createdAt: true,
  notificationStatus: true,
  items: { select: { mpn: true, manufacturer: true, description: true, quantity: true }, orderBy: { lineNumber: "asc" as const } },
} as const;

async function nextReference(tx: Prisma.TransactionClient, source: WebsiteEnquiryInput["source"]): Promise<string> {
  const sequence = source === "CONTACT" ? "enquiry_counter_seq" : "rfq_counter_seq";
  const rows = await tx.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval(${sequence}::regclass) AS nextval
  `;
  const prefix = source === "CONTACT" ? "ENQ" : "RFQ";
  return `${prefix}-${new Date().getFullYear()}-${String(rows[0].nextval).padStart(6, "0")}`;
}

function adminLeadUrl(): string {
  return `${env.CORS_ORIGIN.split(",")[0].trim().replace(/\/$/, "")}/admin/leads`;
}

function safeNotificationError(error: unknown): string {
  if (error instanceof Error && error.message === "Email provider is not configured") return error.message;
  return "Notification delivery failed";
}

export async function createWebsiteEnquiry(
  input: WebsiteEnquiryInput,
  idempotencyKey: string | undefined,
  request: { ipAddress?: string; userAgent?: string },
) {
  if (input.website) return { ignored: true as const };

  if (idempotencyKey) {
    const existing = await prisma.lead.findUnique({ where: { idempotencyKey }, select: WEBSITE_LEAD_SELECT });
    if (existing) return { lead: existing, duplicate: true as const };
  }

  let lead;
  try {
    lead = await prisma.$transaction(async (tx) => {
      const referenceNumber = await nextReference(tx, input.source);
      const created = await tx.lead.create({
        data: {
          referenceNumber,
          idempotencyKey,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone || undefined,
          companyName: input.companyName,
          subject: input.subject || undefined,
          deliveryLocation: input.deliveryLocation || undefined,
          requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
          source: input.source,
          notes: input.message,
          notificationStatus: "PENDING",
          items: { create: input.items.map((item, index) => ({ ...item, lineNumber: index + 1 })) },
        },
        select: WEBSITE_LEAD_SELECT,
      });
      await auditInTx(tx, {
        action: "website_enquiry.created",
        entityType: "lead",
        entityId: created.id,
        newValue: { referenceNumber, source: input.source },
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      });
      return created;
    });
  } catch (error) {
    if (idempotencyKey && (error as { code?: string }).code === "P2002") {
      const existing = await prisma.lead.findUnique({ where: { idempotencyKey }, select: WEBSITE_LEAD_SELECT });
      if (existing) return { lead: existing, duplicate: true as const };
    }
    throw error;
  }

  try {
    const delivery = await sendEmail({
      to: env.ENQUIRY_NOTIFICATION_TO,
      replyTo: input.contactEmail,
      subject: input.source === "CONTACT"
        ? `New Website Enquiry — ${lead.referenceNumber}`
        : input.source === "BOM"
          ? `New BOM Enquiry — ${lead.referenceNumber}`
          : `New RFQ — ${lead.referenceNumber}`,
      html: websiteEnquiryEmail({
        referenceNumber: lead.referenceNumber!,
        source: input.source,
        submittedAt: lead.createdAt.toISOString(),
        contactName: input.contactName,
        companyName: input.companyName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        subject: input.subject,
        message: input.message,
        deliveryLocation: input.deliveryLocation,
        requiredDate: input.requiredDate,
        items: lead.items,
        adminUrl: adminLeadUrl(),
      }),
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { notificationStatus: "SENT", notificationSentAt: new Date(), notificationMessageId: delivery.messageId ?? undefined, notificationError: null },
    });
    await prisma.auditLog.create({ data: { action: "website_enquiry.notification_sent", entityType: "lead", entityId: lead.id } });
  } catch (error) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { notificationStatus: "FAILED", notificationError: safeNotificationError(error) },
    }).catch((updateError) => console.error("[website-enquiry] notification status update failed", updateError));
    await prisma.auditLog.create({ data: { action: "website_enquiry.notification_failed", entityType: "lead", entityId: lead.id } })
      .catch((auditError) => console.error("[website-enquiry] notification audit failed", auditError));
  }

  return { lead, duplicate: false as const };
}
