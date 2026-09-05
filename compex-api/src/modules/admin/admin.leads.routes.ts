import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ok, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { audit } from "../../lib/audit.js";
import { cancelFollowUps } from "../../jobs/follow-up-scheduler.js";
import { normalizeMpn } from "../catalog-import/normalizer.js";
import { nextRfqNumber } from "../rfqs/rfq-number.js";

const LEAD_SELECT = {
  id: true,
  referenceNumber: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  companyName: true,
  source: true,
  status: true,
  priority: true,
  lastContactAt: true,
  nextFollowUpAt: true,
  notes: true,
  subject: true,
  deliveryLocation: true,
  requiredDate: true,
  notificationStatus: true,
  notificationSentAt: true,
  notificationError: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, accountNumber: true, company: { select: { name: true } } } },
  rfq: { select: { id: true, rfqNumber: true, status: true } },
  items: { select: { id: true, lineNumber: true, mpn: true, manufacturer: true, description: true, quantity: true }, orderBy: { lineNumber: "asc" } },
  assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

const LeadSourceSchema = z.enum([
  "GOOGLE_ORGANIC", "GOOGLE_ADS", "LINKEDIN", "WHATSAPP", "EMAIL", "DIRECT", "REFERRAL", "OTHER",
  "CONTACT", "REQUEST_QUOTE", "BOM", "CUSTOMER_PORTAL",
]);

const LeadPatch = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "WON", "LOST"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
  lastContactAt: z.string().datetime().optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  source: LeadSourceSchema.optional(),
});

const LeadCreate = z.object({
  customerId: z.string().uuid().optional(),
  rfqId: z.string().uuid().optional(),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(30).optional(),
  companyName: z.string().min(1).max(200),
  source: LeadSourceSchema.default("DIRECT"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  notes: z.string().max(5000).optional(),
});

const ConvertLeadToRfq = z.object({
  customerId: z.string().uuid(),
});

// Neutralize CSV formula injection: a leading =, +, -, @, tab, or CR makes
// Excel/Sheets interpret the cell as a formula when the file is opened.
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const LeadExportQuery = z.object({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "WON", "LOST"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  source: LeadSourceSchema.optional(),
  assignedToId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

export async function adminLeadsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("STAFF", "ADMIN"));

  // Registered before "/:id" so the literal path always wins over the param route.
  app.get("/export", async (req, reply) => {
    const q = LeadExportQuery.parse(req.query);
    const where = {
      ...(q.status && { status: q.status }),
      ...(q.priority && { priority: q.priority }),
      ...(q.source && { source: q.source }),
      ...(q.assignedToId && { assignedToId: q.assignedToId }),
      ...(q.customerId && { customerId: q.customerId }),
    };
    const leads = await prisma.lead.findMany({
      where,
      select: {
        referenceNumber: true,
        contactName: true,
        companyName: true,
        contactEmail: true,
        contactPhone: true,
        status: true,
        notes: true,
        createdAt: true,
        items: { select: { mpn: true, quantity: true } },
        rfq: { select: { rfqNumber: true, items: { select: { mpn: true, quantity: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const header = ["Reference Number", "Customer Name", "Company", "Email", "Phone", "Product/Component", "Quantity", "Message", "Status", "Created At"];
    const rows = leads.map((lead) => {
      // Enquiry-form leads carry their own LeadItem rows; portal-RFQ leads don't —
      // fall back to the linked RFQ's items so the export isn't blank for them.
      const items = lead.items.length ? lead.items : (lead.rfq?.items ?? []);
      return [
        lead.referenceNumber ?? lead.rfq?.rfqNumber ?? "",
        lead.contactName,
        lead.companyName,
        lead.contactEmail,
        lead.contactPhone ?? "",
        items.map((item) => item.mpn).join("; "),
        items.map((item) => item.quantity).join("; "),
        (lead.notes ?? "").replace(/\r?\n/g, " "),
        lead.status,
        lead.createdAt.toISOString(),
      ];
    });
    const csv = [header, ...rows].map((row) => row.map((cell) => csvCell(String(cell))).join(",")).join("\r\n");

    audit({ userId: req.user!.id, action: "lead.exported", entityType: "lead", newValue: { count: leads.length } });
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="compex-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  app.get("/", async (req, reply) => {
    const q = z.object({
      status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "WON", "LOST"]).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      source: LeadSourceSchema.optional(),
      assignedToId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }).parse(req.query);

    const where = {
      ...(q.status && { status: q.status }),
      ...(q.priority && { priority: q.priority }),
      ...(q.source && { source: q.source }),
      ...(q.assignedToId && { assignedToId: q.assignedToId }),
      ...(q.customerId && { customerId: q.customerId }),
    };
    const skip = (q.page - 1) * q.limit;
    const [data, total] = await prisma.$transaction([
      prisma.lead.findMany({ where, select: LEAD_SELECT, skip, take: q.limit, orderBy: { createdAt: "desc" } }),
      prisma.lead.count({ where }),
    ]);
    return reply.send(paginated(data, total, q.page, q.limit));
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const lead = await prisma.lead.findUnique({ where: { id }, select: LEAD_SELECT });
    if (!lead) throw Errors.notFound("Lead");
    return reply.send(ok(lead));
  });

  app.post("/", async (req, reply) => {
    const body = LeadCreate.parse(req.body);
    const lead = await prisma.lead.create({ data: body, select: LEAD_SELECT });
    audit({ userId: req.user!.id, action: "lead.created", entityType: "lead", entityId: lead.id });
    return reply.status(201).send(ok(lead));
  });

  // Public enquiries remain Leads until a staff member selects the customer
  // account that will own the portal RFQ. This avoids silently creating
  // customer accounts or anonymous RFQs from a public form submission.
  app.post("/:id/convert-to-rfq", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { customerId } = ConvertLeadToRfq.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id },
        select: {
          id: true,
          rfqId: true,
          customerId: true,
          priority: true,
          deliveryLocation: true,
          requiredDate: true,
          notes: true,
          items: {
            select: {
              productId: true,
              lineNumber: true,
              mpn: true,
              manufacturer: true,
              description: true,
              quantity: true,
            },
            orderBy: { lineNumber: "asc" },
          },
        },
      });
      if (!lead) throw Errors.notFound("Lead");
      if (lead.rfqId) throw Errors.conflict("Lead is already linked to an RFQ");
      if (lead.items.length === 0) throw Errors.unprocessable("Only enquiries with component line items can be converted to an RFQ");

      const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      if (!customer) throw Errors.notFound("Customer");

      const normalizedMpns = [...new Set(lead.items.filter((item) => !item.productId).map((item) => normalizeMpn(item.mpn)))];
      const products = normalizedMpns.length
        ? await tx.product.findMany({ where: { normalizedMpn: { in: normalizedMpns } }, select: { id: true, normalizedMpn: true } })
        : [];
      const productByNormalizedMpn = new Map(products.map((product) => [product.normalizedMpn, product.id]));

      const rfq = await tx.rfq.create({
        data: {
          rfqNumber: await nextRfqNumber(tx),
          customerId,
          status: "SUBMITTED",
          sourcingStatus: "NEW",
          priority: lead.priority,
          deliveryLocation: lead.deliveryLocation,
          requiredDate: lead.requiredDate,
          additionalNotes: lead.notes,
          submittedAt: new Date(),
          items: {
            create: lead.items.map((item) => ({
              productId: item.productId ?? productByNormalizedMpn.get(normalizeMpn(item.mpn)),
              lineNumber: item.lineNumber,
              mpn: item.mpn,
              manufacturer: item.manufacturer,
              description: item.description,
              quantity: item.quantity,
            })),
          },
        },
        select: {
          id: true,
          rfqNumber: true,
          sourcingStatus: true,
          items: { select: { id: true, productId: true, mpn: true, quantity: true } },
        },
      });

      const linkedLead = await tx.lead.update({
        where: { id: lead.id },
        data: { customerId, rfqId: rfq.id },
        select: LEAD_SELECT,
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          customerId,
          action: "lead.converted_to_rfq",
          entityType: "lead",
          entityId: lead.id,
          oldValue: { customerId: lead.customerId, rfqId: null },
          newValue: { customerId, rfqId: rfq.id, rfqNumber: rfq.rfqNumber },
        },
      });
      return { lead: linkedLead, rfq };
    });

    return reply.status(201).send(ok(result));
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const existing = await prisma.lead.findUnique({ where: { id }, select: { id: true, status: true, rfqId: true } });
    if (!existing) throw Errors.notFound("Lead");

    const body = LeadPatch.parse(req.body);
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...body,
        lastContactAt: body.lastContactAt ? new Date(body.lastContactAt) : body.lastContactAt,
        nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : body.nextFollowUpAt,
      },
      select: LEAD_SELECT,
    });

    if ((body.status === "WON" || body.status === "LOST") && existing.rfqId) {
      cancelFollowUps(existing.rfqId).catch((err) => console.error("[FOLLOWUP] Cancel failed:", err));
    }

    audit({ userId: req.user!.id, action: "lead.updated", entityType: "lead", entityId: id, newValue: body });
    return reply.send(ok(lead));
  });
}
