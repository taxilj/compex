import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "8f14e45f-ceea-467a-9575-9f1b8e8d1a11";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  userUpdate: vi.fn(),
  tokenUpdateMany: vi.fn(),
  auditInTx: vi.fn(),
}));

vi.mock("../../src/middleware/authenticate.js", () => ({
  authenticate: async (req: { user?: unknown }) => {
    req.user = { id: "admin-1", role: "ADMIN" };
  },
}));
vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { user: { findUnique: mocks.findUnique }, $transaction: mocks.transaction },
}));
vi.mock("../../src/lib/audit.js", () => ({ auditInTx: mocks.auditInTx }));
vi.mock("../../src/lib/settings-validation.js", () => ({ assertValidSettingValues: vi.fn() }));
vi.mock("../../src/lib/email.js", () => ({ accountSetupEmail: vi.fn(), sendEmail: vi.fn() }));
vi.mock("../../src/lib/jwt.js", () => ({ hashToken: vi.fn() }));
vi.mock("../../src/config/env.js", () => ({ env: { CORS_ORIGIN: "http://localhost" } }));

import { adminUsersRoutes } from "../../src/modules/admin/admin.users.routes.js";

const existing = { id: USER_ID, email: "staff@example.test", role: "STAFF", status: "ACTIVE" };

async function patch(payload: Record<string, unknown>) {
  const app = Fastify();
  await app.register(adminUsersRoutes, { prefix: "/users" });
  try {
    return await app.inject({ method: "PATCH", url: `/users/${USER_ID}`, payload });
  } finally {
    await app.close();
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue(existing);
  mocks.userUpdate.mockImplementation(async ({ data }: { data: object }) => ({ ...existing, ...data }));
  mocks.transaction.mockImplementation(async (run: (tx: unknown) => unknown) =>
    run({ user: { update: mocks.userUpdate }, refreshToken: { updateMany: mocks.tokenUpdateMany } }),
  );
});

afterEach(() => vi.clearAllMocks());

describe("PATCH /admin/users/:id session handling", () => {
  it("revokes every live refresh token and audits it when suspending", async () => {
    const res = await patch({ status: "SUSPENDED" });

    expect(res.statusCode).toBe(200);
    expect(mocks.tokenUpdateMany).toHaveBeenCalledTimes(1);
    expect(mocks.tokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    const actions = mocks.auditInTx.mock.calls.map(([, params]) => params.action);
    expect(actions).toEqual(expect.arrayContaining(["user.updated", "user.sessions_revoked"]));
  });

  it("does not revoke sessions for an ordinary profile edit", async () => {
    const res = await patch({ mobile: "9876543210" });

    expect(res.statusCode).toBe(200);
    expect(mocks.tokenUpdateMany).not.toHaveBeenCalled();
  });

  it("does not revoke sessions when reactivating", async () => {
    const res = await patch({ status: "ACTIVE" });

    expect(res.statusCode).toBe(200);
    expect(mocks.tokenUpdateMany).not.toHaveBeenCalled();
  });
});
