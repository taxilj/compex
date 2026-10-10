import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(), upsert: vi.fn(), leadUpdate: vi.fn(), audit: vi.fn(),
  send: vi.fn(), notify: vi.fn(), schedule: vi.fn(), transaction: vi.fn(),
}));
vi.mock("../../src/config/env.js", () => ({ env: { ENQUIRY_NOTIFICATION_TO: "sales@compexsolution.com" } }));
vi.mock("../../src/lib/audit.js", () => ({ audit: vi.fn() }));
vi.mock("../../src/jobs/follow-up-scheduler.js", () => ({ scheduleFollowUps: mocks.schedule }));
vi.mock("../../src/lib/email.js", () => ({
  sendEmail: (opts: { to: string }) => opts.to === "sales@compexsolution.com" ? mocks.notify(opts) : mocks.send(opts),
  sendEmailWithRetry: mocks.notify,
  rfqConfirmationEmail: vi.fn(() => "confirmation"), websiteEnquiryEmail: vi.fn(() => "notification"),
}));
vi.mock("../../src/modules/leads/website-enquiries.service.js", () => ({
  adminLeadUrl: () => "https://example.test/admin/leads",
  safeNotificationError: () => "Notification delivery failed",
}));
vi.mock("../../src/lib/prisma.js", () => ({ prisma: {
  rfq: { findUnique: vi.fn(async () => ({ id: "rfq-1", customerId: "customer-1", status: "DRAFT" })) },
  rfqItem: { count: vi.fn(async () => 1), findMany: vi.fn(async () => [{ mpn: "QA-001", quantity: 1 }]) },
  customer: { findUnique: vi.fn(async () => ({
    user: { email: "buyer@example.test", firstName: "QA", lastName: "Buyer", phone: null }, company: { name: "QA" },
  })) },
  lead: { update: mocks.leadUpdate }, $transaction: mocks.transaction,
} }));

import { submitRfq } from "../../src/modules/rfqs/rfqs.service.js";

describe("portal RFQ sales notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({ rfqNumber: "RFQ-QA-001", deliveryLocation: null });
    mocks.upsert.mockResolvedValue({ id: "lead-1" });
    mocks.send.mockResolvedValue({});
    mocks.notify.mockResolvedValue({ messageId: "qa-message" });
    mocks.schedule.mockResolvedValue(undefined);
    mocks.leadUpdate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback({
      rfq: { update: mocks.update }, lead: { upsert: mocks.upsert }, auditLog: { create: mocks.audit },
    }));
  });

  it("commits the RFQ before notifying sales with the customer as Reply-To", async () => {
    await submitRfq("rfq-1", "customer-1", "user-1");
    await vi.waitFor(() => expect(mocks.leadUpdate).toHaveBeenCalled());
    expect(mocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(mocks.notify.mock.invocationCallOrder[0]);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ to: "sales@compexsolution.com", replyTo: "buyer@example.test" }));
    expect(mocks.leadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificationStatus: "SENT" }) }));
  });

  it("allows only one notification when two submissions race for the same draft", async () => {
    mocks.update.mockRejectedValueOnce({ code: "P2025" });
    const results = await Promise.allSettled([
      submitRfq("rfq-1", "customer-1", "user-1"), submitRfq("rfq-1", "customer-1", "user-1"),
    ]);
    await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledTimes(1));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { statusCode: 422 } });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "rfq-1", status: "DRAFT" } }));
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("keeps the submitted RFQ when SMTP fails and marks the notification FAILED", async () => {
    mocks.notify.mockRejectedValue(new Error("SMTP failure"));
    await expect(submitRfq("rfq-1", "customer-1", "user-1")).resolves.toMatchObject({ rfqNumber: "RFQ-QA-001" });
    await vi.waitFor(() => expect(mocks.leadUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { notificationStatus: "FAILED", notificationError: "Notification delivery failed" },
    })));
  });
});
