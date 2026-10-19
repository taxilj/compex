import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("../../src/lib/prisma.js", () => ({ prisma: { auditLog: { create: mocks.create } } }));

import { audit, auditInTx, redactAuditValue } from "../../src/lib/audit.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({});
});

describe("redactAuditValue", () => {
  it("removes bank, credit and credential keys, case-insensitively", () => {
    const input = {
      companyName: "Acme",
      currency: "INR",
      bankName: "B",
      bankAccount: "SENTINEL-ACCOUNT-1",
      bankAddress: "A",
      swiftIfscMicr: "S",
      routingCode: "R",
      BANKDETAILS: "D",
      creditLimit: 500,
      shippingAccount: "SH",
      internalAccountNumber: "I",
      passwordHash: "H",
      tokenHash: "T",
    };

    expect(redactAuditValue(input)).toEqual({ companyName: "Acme", currency: "INR" });
  });

  it("redacts at any depth and inside arrays", () => {
    const input = {
      id: 1,
      company: { name: "C", bankDetails: "x", creditLimit: 5 },
      rows: [{ id: 2, shippingAccount: "s" }, { id: 3 }],
    };

    expect(redactAuditValue(input)).toEqual({
      id: 1,
      company: { name: "C" },
      rows: [{ id: 2 }, { id: 3 }],
    });
  });

  it("does not mutate its input", () => {
    const input = { a: 1, nested: { bankAccount: "keep-in-original" } };
    const snapshot = JSON.parse(JSON.stringify(input));

    redactAuditValue(input);

    expect(input).toEqual(snapshot);
  });

  it("leaves dates, null, primitives and non-plain objects untouched", () => {
    class Money {
      constructor(public readonly amount: string) {}
      toJSON() {
        return this.amount;
      }
    }
    const when = new Date("2026-10-19T00:00:00Z");
    const money = new Money("12.50");

    const result = redactAuditValue({ when, none: null, count: 3, label: "x", money }) as Record<string, unknown>;

    expect(result.when).toBe(when);
    expect(result.none).toBeNull();
    expect(result.count).toBe(3);
    expect(result.label).toBe("x");
    expect(result.money).toBe(money);
  });

  it("returns undefined for undefined and passes primitives through", () => {
    expect(redactAuditValue(undefined)).toBeUndefined();
    expect(redactAuditValue("plain")).toBe("plain");
    expect(redactAuditValue(7)).toBe(7);
  });
});

describe("audit writers apply the redaction", () => {
  it("auditInTx persists redacted old and new values", async () => {
    const tx = { auditLog: { create: mocks.create } };

    await auditInTx(tx as never, {
      action: "organization.updated",
      oldValue: { companyName: "Old", bankAccount: "SENTINEL-OLD" },
      newValue: { companyName: "New", bankAccount: "SENTINEL-NEW", routingCode: "RC" },
    });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.oldValue).toEqual({ companyName: "Old" });
    expect(data.newValue).toEqual({ companyName: "New" });
    expect(JSON.stringify(data)).not.toContain("SENTINEL");
  });

  it("audit() persists redacted values too", async () => {
    audit({
      action: "company.updated",
      oldValue: { name: "Old", bankDetails: "SENTINEL-BANK", creditLimit: 99 },
      newValue: { name: "New" },
    });
    await Promise.resolve();

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const data = mocks.create.mock.calls[0][0].data;
    expect(data.oldValue).toEqual({ name: "Old" });
    expect(JSON.stringify(data)).not.toContain("SENTINEL");
  });

  it("keeps old and new values undefined when none are given", async () => {
    const tx = { auditLog: { create: mocks.create } };

    await auditInTx(tx as never, { action: "user.sessions_revoked" });

    const data = mocks.create.mock.calls[0][0].data;
    expect(data.oldValue).toBeUndefined();
    expect(data.newValue).toBeUndefined();
  });
});
