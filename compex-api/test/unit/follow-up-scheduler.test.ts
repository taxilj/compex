import { describe, it, expect, vi, beforeEach } from "vitest";

// Follow-ups are DB-driven (no Redis): scheduling writes FollowUp rows and the
// worker polls Postgres for due rows. ioredis/bullmq are mocked only to prove
// that nothing in this path touches Redis.

const mocks = vi.hoisted(() => ({
  ioredis: vi.fn(),
  queue: vi.fn(),
  followUpFindUnique: vi.fn(),
  followUpCreate: vi.fn(),
  followUpUpdate: vi.fn(),
  followUpUpdateMany: vi.fn(),
  followUpFindMany: vi.fn(),
  leadFindUnique: vi.fn(),
  rfqFindUnique: vi.fn(),
  quotationFindFirst: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("ioredis", () => ({ default: mocks.ioredis }));
vi.mock("bullmq", () => ({ Queue: mocks.queue, Worker: mocks.queue }));
vi.mock("../../src/lib/email.js", () => ({
  sendEmail: mocks.sendEmail,
  followUpEmail: () => "<p>follow-up</p>",
  emailFailureReason: () => "Error ETIMEDOUT",
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    lead: { findUnique: mocks.leadFindUnique },
    rfq: { findUnique: mocks.rfqFindUnique },
    quotation: { findFirst: mocks.quotationFindFirst },
    followUp: {
      findUnique: mocks.followUpFindUnique,
      create: mocks.followUpCreate,
      update: mocks.followUpUpdate,
      updateMany: mocks.followUpUpdateMany,
      findMany: mocks.followUpFindMany,
    },
  },
}));

import { cancelFollowUps, scheduleFollowUps } from "../../src/jobs/follow-up-scheduler.js";
import { INTERRUPTED_FOLLOW_UP_REASON, processFollowUp, sendDueFollowUps } from "../../src/jobs/follow-up-worker.js";

const openRfq = {
  rfqNumber: "RFQ-2026-000010",
  status: "SUBMITTED",
  customer: { user: { email: "buyer@example.com", firstName: "Asha", lastName: "Buyer" } },
  quotations: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.leadFindUnique.mockResolvedValue(null);
  mocks.followUpCreate.mockImplementation(async ({ data }) => ({ id: `fu-${data.type}`, ...data }));
  mocks.followUpUpdateMany.mockResolvedValue({ count: 1 });
  mocks.followUpUpdate.mockResolvedValue({});
  mocks.rfqFindUnique.mockResolvedValue(openRfq);
  mocks.quotationFindFirst.mockResolvedValue(null);
  mocks.sendEmail.mockResolvedValue({ messageId: "m1" });
});

describe("scheduleFollowUps", () => {
  it("creates the four day-offset rows in Postgres and never touches Redis", async () => {
    mocks.followUpFindUnique.mockResolvedValue(null);
    await scheduleFollowUps("rfq-1");
    expect(mocks.followUpCreate.mock.calls.map(([arg]) => arg.data.type)).toEqual(["DAY_1", "DAY_3", "DAY_7", "DAY_14"]);
    expect(mocks.ioredis).not.toHaveBeenCalled();
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("is idempotent: existing follow-up types are not duplicated", async () => {
    mocks.followUpFindUnique.mockImplementation(async ({ where }) => (where.rfqId_type.type === "DAY_1" ? { id: "existing" } : null));
    await scheduleFollowUps("rfq-1");
    expect(mocks.followUpCreate).toHaveBeenCalledTimes(3);
  });

  it("cancel marks every still-scheduled row CANCELLED in one write", async () => {
    mocks.followUpUpdateMany.mockResolvedValue({ count: 4 });
    await cancelFollowUps("rfq-1");
    expect(mocks.followUpUpdateMany).toHaveBeenCalledWith({
      where: { rfqId: "rfq-1", status: "SCHEDULED" },
      data: { status: "CANCELLED", cancelledAt: expect.any(Date) },
    });
  });
});

describe("follow-up poller", () => {
  it("only selects due, unsent, scheduled rows in a bounded batch", async () => {
    mocks.followUpFindMany.mockResolvedValue([]);
    const now = new Date("2026-10-03T12:00:00Z");
    await sendDueFollowUps(now);
    expect(mocks.followUpFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "SCHEDULED", sentAt: null, scheduledAt: { lte: now } },
      take: 25,
    }));
  });

  it("sends a due follow-up once and marks it SENT", async () => {
    mocks.followUpFindUnique.mockResolvedValue({ id: "fu-1", status: "SCHEDULED", type: "DAY_1", rfqId: "rfq-1", leadId: null });
    await processFollowUp("fu-1");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.followUpUpdate).toHaveBeenCalledWith({ where: { id: "fu-1" }, data: { status: "SENT" } });
  });

  it("does not send when another poll already claimed the row (no duplicate email)", async () => {
    mocks.followUpFindUnique.mockResolvedValue({ id: "fu-1", status: "SCHEDULED", type: "DAY_1", rfqId: "rfq-1", leadId: null });
    mocks.followUpUpdateMany.mockResolvedValue({ count: 0 });
    await processFollowUp("fu-1");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("records a sanitized FAILED reason and keeps polling the rest when a send fails", async () => {
    mocks.followUpFindMany.mockResolvedValue([{ id: "fu-1" }, { id: "fu-2" }]);
    mocks.followUpFindUnique.mockImplementation(async ({ where }) => ({ id: where.id, status: "SCHEDULED", type: "DAY_1", rfqId: "rfq-1", leadId: null }));
    mocks.sendEmail.mockRejectedValueOnce(new Error("timeout for buyer@example.com")).mockResolvedValueOnce({ messageId: "m2" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendDueFollowUps()).resolves.toBe(2);
    expect(mocks.followUpUpdate).toHaveBeenCalledWith({
      where: { id: "fu-1" },
      data: { status: "FAILED", failureReason: "Error ETIMEDOUT", sentAt: null },
    });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("cancels instead of sending when the RFQ already has an accepted/rejected quotation", async () => {
    mocks.followUpFindUnique.mockResolvedValue({ id: "fu-1", status: "SCHEDULED", type: "DAY_3", rfqId: "rfq-1", leadId: null });
    mocks.rfqFindUnique.mockResolvedValue({ ...openRfq, quotations: [{ id: "q1" }] });
    await processFollowUp("fu-1");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.followUpUpdate).toHaveBeenCalledWith({ where: { id: "fu-1" }, data: { status: "CANCELLED", cancelledAt: expect.any(Date) } });
  });

  it("marks rows stranded mid-send as FAILED instead of re-sending them", async () => {
    mocks.followUpFindMany.mockResolvedValue([]);
    const now = new Date("2026-10-03T12:00:00Z");
    await sendDueFollowUps(now);
    expect(mocks.followUpUpdateMany).toHaveBeenCalledWith({
      where: { status: "SCHEDULED", sentAt: { lt: new Date("2026-10-03T11:00:00Z") } },
      data: { status: "FAILED", failureReason: INTERRUPTED_FOLLOW_UP_REASON },
    });
  });

  it("one row that throws does not block the rows behind it", async () => {
    mocks.followUpFindMany.mockResolvedValue([{ id: "bad" }, { id: "good" }]);
    mocks.followUpFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === "bad") throw new Error("db glitch");
      return { id: where.id, status: "SCHEDULED", type: "DAY_1", rfqId: "rfq-1", leadId: null };
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(sendDueFollowUps()).resolves.toBe(2);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });
});
