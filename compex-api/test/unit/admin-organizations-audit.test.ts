import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG_ID = "0b3c1d5e-7a4f-4c1e-9d3a-2f6a8b9c0d11";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  orgCreate: vi.fn(),
  orgUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../../src/middleware/authenticate.js", () => ({
  authenticate: async (req: { user?: unknown }) => {
    req.user = { id: "admin-1", role: "ADMIN" };
  },
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { organization: { findUnique: mocks.findUnique }, $transaction: mocks.transaction },
}));

import { adminOrganizationsRoutes } from "../../src/modules/admin/admin.organizations.routes.js";

const bank = {
  bankName: "SENTINEL-BANK-NAME",
  bankAccount: "SENTINEL-ACCOUNT-1",
  bankAddress: "SENTINEL-BANK-ADDRESS",
  swiftIfscMicr: "SENTINEL-SWIFT",
  routingCode: "SENTINEL-ROUTING",
};

async function send(method: "POST" | "PATCH", url: string, payload: Record<string, unknown>) {
  const app = Fastify();
  await app.register(adminOrganizationsRoutes, { prefix: "/organizations" });
  try {
    return await app.inject({ method, url, payload });
  } finally {
    await app.close();
  }
}

function auditedRows(): string {
  return JSON.stringify(mocks.auditCreate.mock.calls.map(([arg]) => arg.data));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.orgCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: ORG_ID, ...data }));
  mocks.orgUpdate.mockImplementation(async ({ data }: { data: object }) => ({ id: ORG_ID, companyName: "Acme", currency: "INR", ...data }));
  mocks.auditCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (run: (tx: unknown) => unknown) =>
    run({
      organization: { create: mocks.orgCreate, update: mocks.orgUpdate },
      auditLog: { create: mocks.auditCreate },
    }),
  );
});

describe("organization audit history", () => {
  it("records a created organization without any bank field", async () => {
    const res = await send("POST", "/organizations", { companyName: "Acme", shortName: "ACM", currency: "INR", ...bank });

    expect(res.statusCode).toBe(201);
    const rows = auditedRows();
    expect(rows).toContain("organization.created");
    expect(rows).toContain("Acme");
    expect(rows).not.toContain("SENTINEL");
  });

  it("records an updated organization (old and new) without any bank field", async () => {
    mocks.findUnique.mockResolvedValue({ id: ORG_ID, companyName: "Acme", currency: "INR", bankAccount: "SENTINEL-OLD-ACCOUNT", routingCode: "SENTINEL-OLD-ROUTING" });

    const res = await send("PATCH", `/organizations/${ORG_ID}`, { website: "https://example.test", ...bank });

    expect(res.statusCode).toBe(200);
    const rows = auditedRows();
    expect(rows).toContain("organization.updated");
    expect(rows).toContain("https://example.test");
    expect(rows).not.toContain("SENTINEL");
  });

  it("still returns the bank fields to the admin caller", async () => {
    const res = await send("POST", "/organizations", { companyName: "Acme", shortName: "ACM", currency: "INR", ...bank });

    expect(res.json().data.bankAccount).toBe("SENTINEL-ACCOUNT-1");
  });
});
