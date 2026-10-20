import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  auditCount: vi.fn(),
  auditCreate: vi.fn(),
  send: vi.fn(),
  build: vi.fn(() => "<html>"),
}));

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    lead: { findMany: mocks.findMany, updateMany: mocks.updateMany, update: mocks.update },
    auditLog: { count: mocks.auditCount, create: mocks.auditCreate },
  },
}));
vi.mock("../../src/config/env.js", () => ({ env: { ENQUIRY_NOTIFICATION_TO: "sales@example.test" } }));
vi.mock("../../src/lib/email.js", () => ({
  sendEmailWithRetry: mocks.send,
  websiteEnquiryEmail: mocks.build,
  describeEmailError: () => ({}),
}));
vi.mock("../../src/modules/leads/website-enquiries.service.js", () => ({
  adminLeadUrl: () => "https://admin.example.test/admin/leads",
  safeNotificationError: (error: unknown) =>
    error instanceof Error && error.message === "Email provider is not configured" ? error.message : "Notification delivery failed",
}));

import { recoverFailedNotifications, startNotificationRecovery } from "../../src/jobs/notification-recovery.js";

const NOW = new Date("2026-10-19T12:00:00Z");
const MINUTE = 60_000;

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "l1",
    referenceNumber: "ENQ-2026-000001",
    source: "CONTACT",
    notificationStatus: "FAILED",
    updatedAt: new Date(NOW.getTime() - 30 * MINUTE),
    createdAt: new Date(NOW.getTime() - 60 * MINUTE),
    contactName: "Asha",
    contactEmail: "asha@example.test",
    contactPhone: "9876543210",
    companyName: "Example Co",
    subject: "Hello",
    notes: "Need parts",
    deliveryLocation: "Pune",
    requiredDate: null,
    items: [{ mpn: "LM324N", manufacturer: null, description: null, quantity: 10 }],
    rfq: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.auditCount.mockResolvedValue(0);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.update.mockResolvedValue({});
  mocks.auditCreate.mockResolvedValue({});
  mocks.send.mockResolvedValue({ messageId: "m1", attempts: 1 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("recoverFailedNotifications", () => {
  it("only looks at stale FAILED/PENDING leads inside the retry window, oldest first, in small batches", async () => {
    await recoverFailedNotifications(NOW);

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        notificationStatus: { in: ["FAILED", "PENDING"] },
        updatedAt: { lt: new Date(NOW.getTime() - 10 * MINUTE) },
        createdAt: { gt: new Date(NOW.getTime() - 3 * 24 * 60 * MINUTE) },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
  });

  it("re-sends a FAILED website enquiry to the sales mailbox and marks it SENT", async () => {
    const failed = lead();
    mocks.findMany.mockResolvedValue([failed]);

    const sent = await recoverFailedNotifications(NOW);

    expect(sent).toBe(1);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "l1", notificationStatus: "FAILED", updatedAt: failed.updatedAt },
      data: { notificationStatus: "PENDING" },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "lead.notification_retry", entityType: "lead", entityId: "l1", newValue: { attempt: 1 } }),
    });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "sales@example.test",
      replyTo: "asha@example.test",
      idempotencyKey: "enquiry-notify/l1",
      subject: "New Website Enquiry — ENQ-2026-000001",
    }));
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: expect.objectContaining({ notificationStatus: "SENT", notificationMessageId: "m1", notificationError: null, notificationSentAt: expect.any(Date) }),
    });
  });

  it.each([
    ["CONTACT", "New Website Enquiry — ENQ-2026-000001", "CONTACT"],
    ["BOM", "New BOM Enquiry — ENQ-2026-000001", "BOM"],
    ["REQUEST_QUOTE", "New RFQ — ENQ-2026-000001", "REQUEST_QUOTE"],
    ["DIRECT", "New RFQ — ENQ-2026-000001", "REQUEST_QUOTE"],
  ])("uses the original subject and email source for a %s lead", async (source, subject, emailSource) => {
    mocks.findMany.mockResolvedValue([lead({ source })]);

    await recoverFailedNotifications(NOW);

    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ subject }));
    expect(mocks.build).toHaveBeenCalledWith(expect.objectContaining({ source: emailSource }));
  });

  it("retries a portal-RFQ lead using the RFQ number, RFQ items and the portal message", async () => {
    mocks.findMany.mockResolvedValue([lead({
      referenceNumber: null,
      source: "DIRECT",
      notes: null,
      subject: null,
      deliveryLocation: null,
      items: [],
      rfq: { rfqNumber: "RFQ-2026-000009", deliveryLocation: "Delhi", items: [{ mpn: "NE556N", manufacturer: "TI", description: null, quantity: 5 }] },
    })]);

    await recoverFailedNotifications(NOW);

    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ subject: "New RFQ — RFQ-2026-000009" }));
    expect(mocks.build).toHaveBeenCalledWith(expect.objectContaining({
      referenceNumber: "RFQ-2026-000009",
      source: "REQUEST_QUOTE",
      message: "Submitted via the customer portal RFQ wizard.",
      deliveryLocation: "Delhi",
      items: [{ mpn: "NE556N", manufacturer: "TI", description: null, quantity: 5 }],
    }));
  });

  it("marks the lead FAILED with a safe message when the retry fails, and never throws", async () => {
    mocks.findMany.mockResolvedValue([lead()]);
    mocks.send.mockRejectedValue(new Error("550 relay.secret-host.internal rejected the message"));

    const sent = await recoverFailedNotifications(NOW);

    expect(sent).toBe(0);
    const data = mocks.update.mock.calls[0][0].data;
    expect(data).toEqual({ notificationStatus: "FAILED", notificationError: "Notification delivery failed" });
    expect(JSON.stringify(data)).not.toContain("secret-host");
  });

  it("stops retrying after 5 attempts", async () => {
    mocks.findMany.mockResolvedValue([lead()]);
    mocks.auditCount.mockResolvedValue(5);

    const sent = await recoverFailedNotifications(NOW);

    expect(sent).toBe(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("logs once when the fifth attempt also fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findMany.mockResolvedValue([lead()]);
    mocks.auditCount.mockResolvedValue(4);
    mocks.send.mockRejectedValue(new Error("boom"));

    await recoverFailedNotifications(NOW);

    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ newValue: { attempt: 5 } }) });
    expect(errors.mock.calls.map(([line]) => String(line)).some((line) => line.includes("enquiry_notification_retry_exhausted"))).toBe(true);
  });

  it("does not send when another instance already claimed the lead", async () => {
    mocks.findMany.mockResolvedValue([lead()]);
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const sent = await recoverFailedNotifications(NOW);

    expect(sent).toBe(0);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does nothing when there is nothing to retry", async () => {
    expect(await recoverFailedNotifications(NOW)).toBe(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe("startNotificationRecovery", () => {
  it("never overlaps two sweeps and close() waits for the one in flight", async () => {
    vi.useFakeTimers();
    let release!: (rows: unknown[]) => void;
    mocks.findMany.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

    const handle = startNotificationRecovery(1_000);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(mocks.findMany).toHaveBeenCalledTimes(1);

    release([]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.findMany.mock.calls.length).toBeGreaterThanOrEqual(2);

    await handle.close();
  });

  it("keeps running after a failed sweep", async () => {
    vi.useFakeTimers();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findMany.mockRejectedValueOnce(new Error("db down"));

    const handle = startNotificationRecovery(1_000);
    await vi.advanceTimersByTimeAsync(2_500);

    expect(errors).toHaveBeenCalled();
    expect(mocks.findMany.mock.calls.length).toBeGreaterThanOrEqual(2);
    await handle.close();
  });
});
