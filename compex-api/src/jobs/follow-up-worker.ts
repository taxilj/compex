import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { sendEmail, followUpEmail } from "../lib/email.js";

export function startFollowUpWorker() {
  return new Worker(
    "follow-ups",
    async (job) => {
      const { followUpId, rfqId } = job.data as { followUpId: string; rfqId: string; type: string };

      const followUp = await prisma.followUp.findUnique({
        where: { id: followUpId },
        select: { id: true, status: true, type: true, rfqId: true, leadId: true },
      });

      if (!followUp || followUp.status !== "SCHEDULED") return;

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

      try {
        await sendEmail({
          to: rfq.customer.user.email,
          subject: `Follow-up: RFQ ${rfq.rfqNumber}`,
          html: followUpEmail(customerName, rfq.rfqNumber, followUp.type, latestQuotation?.quotationNumber),
        });
        await prisma.followUp.update({
          where: { id: followUpId },
          data: { status: "SENT", sentAt: new Date() },
        });
      } catch (err) {
        await prisma.followUp.update({
          where: { id: followUpId },
          data: { status: "FAILED", failureReason: String(err) },
        });
        throw err;
      }
    },
    { connection: { url: env.REDIS_URL } },
  );
}
