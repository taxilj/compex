import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

vi.mock("../../src/lib/prisma.js", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("../../src/lib/jwt.js", () => ({ verifyAccessToken: mocks.verifyAccessToken }));

import { authenticate } from "../../src/middleware/authenticate.js";

const reply = {} as FastifyReply;
const payload = { sub: "u1", role: "STAFF", customerId: "c1", companyId: "co1" };

function request(headers: Record<string, string> = { authorization: "Bearer good-token" }): FastifyRequest {
  return { headers, cookies: {} } as unknown as FastifyRequest;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verifyAccessToken.mockReturnValue(payload);
});

describe("authenticate", () => {
  it("accepts an ACTIVE user and takes the role from the database, not the token", async () => {
    mocks.findUnique.mockResolvedValue({ role: "ADMIN", status: "ACTIVE" });
    const req = request();

    await authenticate(req, reply);

    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: "u1" }, select: { role: true, status: true } });
    expect(req.user).toEqual({ id: "u1", role: "ADMIN", customerId: "c1", companyId: "co1" });
  });

  it.each(["SUSPENDED", "PENDING_VERIFICATION"])("rejects a valid token when the user is %s", async (status) => {
    mocks.findUnique.mockResolvedValue({ role: "STAFF", status });

    await expect(authenticate(request(), reply)).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
  });

  it("rejects a valid token whose user no longer exists", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(authenticate(request(), reply)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects an invalid token without touching the database", async () => {
    mocks.verifyAccessToken.mockImplementation(() => {
      throw new Error("jwt expired");
    });

    await expect(authenticate(request(), reply)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a request with no token without touching the database", async () => {
    await expect(authenticate(request({}), reply)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
