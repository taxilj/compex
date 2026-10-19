import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companyFindUnique: vi.fn(),
  companyUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    company: { findUnique: mocks.companyFindUnique, update: mocks.companyUpdate },
    auditLog: { create: mocks.auditCreate },
  },
}));

import { updateMyCompany } from "../../src/modules/customers/customers.service.js";

const fullCompanyRow = {
  id: "co-1",
  name: "Acme",
  gstin: "G1",
  city: "Pune",
  address: "Old street",
  bankDetails: "SENTINEL-BANK-DETAILS",
  creditLimit: 123456,
  internalAccountNumber: "SENTINEL-INTERNAL",
  shippingAccount: "SENTINEL-SHIPPING",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditCreate.mockResolvedValue({});
  mocks.companyFindUnique.mockResolvedValue(fullCompanyRow);
  mocks.companyUpdate.mockResolvedValue({ id: "co-1", name: "Acme", gstin: "G1", city: "Pune", address: "New street" });
});

describe("customer portal company update audit", () => {
  it("never writes bank, credit or account data from the full company row to the audit log", async () => {
    const updated = await updateMyCompany("co-1", "user-1", { address: "New street" });
    await Promise.resolve();

    expect(updated.address).toBe("New street");
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const data = mocks.auditCreate.mock.calls[0][0].data;
    expect(data.action).toBe("company.updated");
    expect(data.oldValue).toMatchObject({ name: "Acme", address: "Old street" });
    expect(JSON.stringify(data)).not.toMatch(/SENTINEL|123456|creditLimit|bankDetails/);
  });
});
