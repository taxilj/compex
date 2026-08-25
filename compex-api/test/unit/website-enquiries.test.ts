import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  auditInTx: vi.fn(),
  findUnique: vi.fn(),
  leadCreate: vi.fn(),
  leadUpdate: vi.fn(),
  queryRaw: vi.fn(),
  sendEmail: vi.fn(),
  transaction: vi.fn(),
  websiteEnquiryEmail: vi.fn(() => "<html>message</html>"),
}));

vi.mock("../../src/config/env.js", () => ({
  env: { CORS_ORIGIN: "https://compex-frontend.vercel.app", ENQUIRY_NOTIFICATION_TO: "sales@compexsolution.com" },
}));
vi.mock("../../src/lib/audit.js", () => ({ auditInTx: mocks.auditInTx }));
vi.mock("../../src/lib/email.js", () => ({ sendEmail: mocks.sendEmail, websiteEnquiryEmail: mocks.websiteEnquiryEmail }));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    lead: { findUnique: mocks.findUnique, update: mocks.leadUpdate },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

import { createWebsiteEnquiry, WebsiteEnquirySchema } from "../../src/modules/leads/website-enquiries.service.js";

const contact = {
  source: "CONTACT" as const,
  contactName: "Asha Buyer",
  contactEmail: "ASHA@EXAMPLE.COM",
  companyName: "Example Components",
  message: "Please contact me about sourcing.",
};

function record(source = "CONTACT") {
  return {
    id: "lead-1",
    referenceNumber: source === "CONTACT" ? "ENQ-2026-000001" : "RFQ-2026-000001",
    source,
    createdAt: new Date("2026-08-25T10:00:00.000Z"),
    notificationStatus: "PENDING",
    items: [],
  };
}

describe("website enquiry intake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(undefined);
    mocks.queryRaw.mockResolvedValue([{ nextval: 1n }]);
    mocks.leadCreate.mockResolvedValue(record());
    mocks.auditInTx.mockResolvedValue(undefined);
    mocks.auditCreate.mockResolvedValue(undefined);
    mocks.leadUpdate.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue({ messageId: "smtp-123" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: mocks.queryRaw,
      lead: { create: mocks.leadCreate },
      auditLog: { create: mocks.auditCreate },
    }));
  });

  it("persists a contact enquiry before sending to the configured sales recipient with Reply-To", async () => {
    const input = WebsiteEnquirySchema.parse(contact);
    const result = await createWebsiteEnquiry(input, "a2cb8e55-f56a-4aac-b199-0ed3e9d7adc1", {});

    expect(result.lead.referenceNumber).toBe("ENQ-2026-000001");
    expect(mocks.leadCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ source: "CONTACT", referenceNumber: "ENQ-2026-000001", contactEmail: "asha@example.com" }),
    }));
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "sales@compexsolution.com",
      replyTo: "asha@example.com",
    }));
    expect(mocks.leadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificationStatus: "SENT", notificationMessageId: "smtp-123" }) }));
  });

  it("persists a quote enquiry with component line items", async () => {
    mocks.leadCreate.mockResolvedValue(record("REQUEST_QUOTE"));
    const input = WebsiteEnquirySchema.parse({
      ...contact,
      source: "REQUEST_QUOTE",
      items: [{ mpn: "STM32F103C8T6", manufacturer: "ST", quantity: 5000 }],
    });

    await createWebsiteEnquiry(input, undefined, {});
    expect(mocks.leadCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        source: "REQUEST_QUOTE",
        items: { create: [expect.objectContaining({ mpn: "STM32F103C8T6", quantity: 5000, lineNumber: 1 })] },
      }),
    }));
  });

  it("rejects malformed email and header-injection input", () => {
    expect(WebsiteEnquirySchema.safeParse({ ...contact, contactEmail: "bad\r\nBcc: victim@example.com" }).success).toBe(false);
    expect(WebsiteEnquirySchema.safeParse({ ...contact, source: "REQUEST_QUOTE" }).success).toBe(false);
  });

  it("keeps the enquiry when email delivery fails and records FAILED", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("SMTP timeout"));
    const result = await createWebsiteEnquiry(WebsiteEnquirySchema.parse(contact), undefined, {});

    expect(result.lead.id).toBe("lead-1");
    expect(mocks.leadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notificationStatus: "FAILED", notificationError: "Notification delivery failed" }),
    }));
  });

  it("returns an existing enquiry for a repeated idempotency key without another email", async () => {
    mocks.findUnique.mockResolvedValue(record());
    const result = await createWebsiteEnquiry(WebsiteEnquirySchema.parse(contact), "a2cb8e55-f56a-4aac-b199-0ed3e9d7adc1", {});

    expect(result.duplicate).toBe(true);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
