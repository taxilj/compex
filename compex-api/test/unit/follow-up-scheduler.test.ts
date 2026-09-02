import { describe, it, expect, vi, beforeEach } from "vitest";

// Unit test for the follow-up scheduler's Redis failure handling (mocks
// ioredis + bullmq entirely -- no real network connection is attempted --
// and mocks Prisma). Mirrors the resilience already verified for the BOM
// upload queue: a producer-side enqueue failure must not hang the caller
// or leave the batch half-processed with an orphaned DB row.

const mockAdd = vi.fn();
const mockGetJob = vi.fn();

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({ on: vi.fn(), quit: vi.fn() })),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockAdd,
    getJob: mockGetJob,
  })),
}));

const createdFollowUps: Array<{ id: string; type: string }> = [];
const deletedIds: string[] = [];

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    lead: { findUnique: vi.fn().mockResolvedValue(null) },
    followUp: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: { type: string } }) => {
        const followUp = { id: `fu-${data.type}`, ...data };
        createdFollowUps.push(followUp);
        return Promise.resolve(followUp);
      }),
      delete: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        deletedIds.push(where.id);
        return Promise.resolve({});
      }),
    },
  },
}));

describe("scheduleFollowUps Redis failure handling", () => {
  beforeEach(() => {
    mockAdd.mockReset();
    mockGetJob.mockReset();
    createdFollowUps.length = 0;
    deletedIds.length = 0;
  });

  it("rolls back only the FollowUp row whose enqueue failed, and still schedules the rest", async () => {
    mockAdd
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:6379")) // DAY_1 fails
      .mockResolvedValueOnce(undefined) // DAY_3
      .mockResolvedValueOnce(undefined) // DAY_7
      .mockResolvedValueOnce(undefined); // DAY_14

    const { scheduleFollowUps } = await import("../../src/jobs/follow-up-scheduler.js");
    await scheduleFollowUps("rfq-123");

    // All four follow-up types were attempted despite the first failure --
    // one enqueue failure must not abort the remaining batch.
    expect(mockAdd).toHaveBeenCalledTimes(4);
    expect(createdFollowUps.map((f) => f.type)).toEqual(["DAY_1", "DAY_3", "DAY_7", "DAY_14"]);

    // Only the row whose queue.add() rejected gets rolled back; the three
    // that enqueued successfully are left alone (still SCHEDULED).
    expect(deletedIds).toEqual(["fu-DAY_1"]);
  });

  it("does not throw when every enqueue attempt fails (fire-and-forget caller stays safe)", async () => {
    mockAdd.mockRejectedValue(new Error("connect ETIMEDOUT"));

    const { scheduleFollowUps } = await import("../../src/jobs/follow-up-scheduler.js");
    await expect(scheduleFollowUps("rfq-456")).resolves.toBeUndefined();

    expect(mockAdd).toHaveBeenCalledTimes(4);
    expect(deletedIds.sort()).toEqual(["fu-DAY_1", "fu-DAY_14", "fu-DAY_3", "fu-DAY_7"].sort());
  });
});
