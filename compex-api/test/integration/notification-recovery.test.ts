import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanDb } from "./helpers.js";
import { prisma } from "../../src/lib/prisma.js";
import { env } from "../../src/config/env.js";
import { recoverFailedNotifications } from "../../src/jobs/notification-recovery.js";

// Real database + the EMAIL_PROVIDER=test outbox: proves the sweep's query, the
// optimistic claim and the status write-back, which the unit test only mocks.

afterAll(async () => { await prisma.$disconnect(); });
beforeEach(async () => { await cleanDb(); });

const MINUTE = 60_000;

async function leadWith(overrides: { referenceNumber: string; notificationStatus: "FAILED" | "PENDING" | "SENT" | null; createdAt?: Date }) {
  return prisma.lead.create({
    data: {
      referenceNumber: overrides.referenceNumber,
      contactName: "Asha",
      contactEmail: "asha@invalid.test",
      companyName: "Example Co",
      source: "CONTACT",
      notes: "Need parts",
      notificationStatus: overrides.notificationStatus,
      notificationError: overrides.notificationStatus === "FAILED" ? "Notification delivery failed" : null,
      createdAt: overrides.createdAt,
      items: { create: [{ lineNumber: 1, mpn: "LM324N", quantity: 10 }] },
    },
  });
}

// leads.updated_at is @updatedAt (Prisma sets it on every write), so age it with SQL.
async function ageUpdatedAt(id: string, minutes: number) {
  await prisma.$executeRaw`UPDATE leads SET updated_at = ${new Date(Date.now() - minutes * MINUTE)} WHERE id = ${id}::uuid`;
}

describe("notification recovery against a real database", () => {
  it("re-sends a stale FAILED lead through the outbox and marks it SENT", async () => {
    const lead = await leadWith({ referenceNumber: "ENQ-TEST-000001", notificationStatus: "FAILED" });
    await ageUpdatedAt(lead.id, 30);

    expect(await recoverFailedNotifications()).toBe(1);

    const after = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after).toMatchObject({ notificationStatus: "SENT", notificationError: null, notificationMessageId: "test-email" });
    expect(after.notificationSentAt).toBeInstanceOf(Date);
    const outbox = await prisma.testEmail.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ to: env.ENQUIRY_NOTIFICATION_TO, subject: "New Website Enquiry — ENQ-TEST-000001" });
    expect(outbox[0].html).toContain("LM324N");
    expect(await prisma.auditLog.count({ where: { action: "lead.notification_retry", entityId: lead.id } })).toBe(1);
  });

  it("leaves recent, old, already-sent and never-notified leads alone", async () => {
    const recent = await leadWith({ referenceNumber: "ENQ-TEST-000002", notificationStatus: "FAILED" }); // just failed: inside the back-off
    const old = await leadWith({ referenceNumber: "ENQ-TEST-000003", notificationStatus: "FAILED", createdAt: new Date(Date.now() - 4 * 24 * 60 * MINUTE) });
    await ageUpdatedAt(old.id, 60);
    const sent = await leadWith({ referenceNumber: "ENQ-TEST-000004", notificationStatus: "SENT" });
    await ageUpdatedAt(sent.id, 60);
    const never = await leadWith({ referenceNumber: "ENQ-TEST-000005", notificationStatus: null });
    await ageUpdatedAt(never.id, 60);

    expect(await recoverFailedNotifications()).toBe(0);

    expect(await prisma.testEmail.count()).toBe(0);
    for (const [lead, status] of [[recent, "FAILED"], [old, "FAILED"], [sent, "SENT"], [never, null]] as const) {
      expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).notificationStatus).toBe(status);
    }
  });

  it("retries a PENDING lead only once it has been stuck past the back-off", async () => {
    const fresh = await leadWith({ referenceNumber: "ENQ-TEST-000006", notificationStatus: "PENDING" });
    const stuck = await leadWith({ referenceNumber: "ENQ-TEST-000007", notificationStatus: "PENDING" });
    await ageUpdatedAt(stuck.id, 30);

    expect(await recoverFailedNotifications()).toBe(1);

    expect((await prisma.lead.findUniqueOrThrow({ where: { id: fresh.id } })).notificationStatus).toBe("PENDING");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: stuck.id } })).notificationStatus).toBe("SENT");
  });

  it("stops after five attempts", async () => {
    const lead = await leadWith({ referenceNumber: "ENQ-TEST-000008", notificationStatus: "FAILED" });
    await ageUpdatedAt(lead.id, 30);
    await prisma.auditLog.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({ action: "lead.notification_retry", entityType: "lead", entityId: lead.id, newValue: { attempt: index + 1 } })),
    });

    expect(await recoverFailedNotifications()).toBe(0);
    expect(await prisma.testEmail.count()).toBe(0);
  });
});
