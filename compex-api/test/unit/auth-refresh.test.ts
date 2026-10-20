import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tokenFindUnique: vi.fn(),
  tokenUpdate: vi.fn(),
  tokenCreate: vi.fn(),
  tokenUpdateMany: vi.fn(),
  userFindUniqueOrThrow: vi.fn(),
  transaction: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    refreshToken: {
      findUnique: mocks.tokenFindUnique,
      update: mocks.tokenUpdate,
      create: mocks.tokenCreate,
      updateMany: mocks.tokenUpdateMany,
    },
    user: { findUniqueOrThrow: mocks.userFindUniqueOrThrow },
    $transaction: mocks.transaction,
  },
}));
vi.mock("../../src/lib/jwt.js", () => ({
  signAccessToken: vi.fn(() => "access-new"),
  generateRefreshTokenRaw: vi.fn(() => "raw-new"),
  hashToken: vi.fn((raw: string) => `hash(${raw})`),
}));
vi.mock("../../src/lib/audit.js", () => ({ audit: mocks.audit, auditInTx: vi.fn() }));
vi.mock("../../src/lib/email.js", () => ({
  emailFailureReason: vi.fn(),
  sendEmail: vi.fn(),
  verificationEmail: vi.fn(),
}));
vi.mock("../../src/config/env.js", () => ({ env: { CORS_ORIGIN: "http://localhost" } }));

import { refresh } from "../../src/modules/auth/auth.service.js";

const storedToken = {
  id: "t1",
  userId: "u1",
  family: "fam",
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
};

beforeEach(() => {
  // clear (not reset): the jwt mock factory above supplies its return values.
  vi.clearAllMocks();
  mocks.transaction.mockResolvedValue([]);
  mocks.tokenFindUnique.mockResolvedValue(storedToken);
});

describe("refresh", () => {
  it("rotates the token for an ACTIVE user", async () => {
    mocks.userFindUniqueOrThrow.mockResolvedValue({ id: "u1", role: "STAFF", status: "ACTIVE", customer: null });

    const result = await refresh("raw-old");

    expect(result).toEqual({ accessToken: "access-new", refreshToken: "raw-new" });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tokenUpdateMany).not.toHaveBeenCalled();
  });

  it.each(["SUSPENDED", "PENDING_VERIFICATION"])(
    "refuses a %s user, revokes the whole token family and issues nothing",
    async (status) => {
      mocks.userFindUniqueOrThrow.mockResolvedValue({ id: "u1", role: "STAFF", status, customer: null });

      await expect(refresh("raw-old")).rejects.toMatchObject({ statusCode: 401 });

      expect(mocks.tokenUpdateMany).toHaveBeenCalledWith({
        where: { family: "fam" },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.tokenCreate).not.toHaveBeenCalled();
    },
  );

  it("still revokes the family when a revoked token is replayed", async () => {
    mocks.tokenFindUnique.mockResolvedValue({ ...storedToken, revokedAt: new Date() });

    await expect(refresh("raw-old")).rejects.toMatchObject({ statusCode: 401 });

    expect(mocks.tokenUpdateMany).toHaveBeenCalledWith({
      where: { family: "fam" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
