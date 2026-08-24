import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ok } from "../../lib/response.js";

const PublicLeadSchema = z.object({
  contactName: z.string().trim().min(1).max(200),
  contactEmail: z.string().trim().email(),
  contactPhone: z.string().trim().max(30).optional(),
  companyName: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
});

export async function publicLeadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = PublicLeadSchema.parse(req.body);
    const notes = [body.subject && `Subject: ${body.subject}`, body.message].filter(Boolean).join("\n\n");
    const lead = await prisma.lead.create({
      data: {
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        companyName: body.companyName,
        source: "DIRECT",
        notes,
      },
      select: { id: true },
    });
    return reply.status(201).send(ok(lead));
  });
}
