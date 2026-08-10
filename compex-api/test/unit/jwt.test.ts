import { describe, it, expect, beforeAll } from "vitest";

// Set env vars before importing jwt module
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-chars-long-for-test";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-32-chars-long";
  process.env.JWT_ACCESS_EXPIRES_IN = "15m";
  process.env.JWT_REFRESH_EXPIRES_IN = "30d";
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.CORS_ORIGIN = "http://localhost:3000";
});

describe("JWT utilities", () => {
  it("signs and verifies access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("../../src/lib/jwt.js");
    const payload = { sub: "user-1", role: "CUSTOMER", customerId: "cust-1" };
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.role).toBe("CUSTOMER");
  });

  it("throws on tampered token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("../../src/lib/jwt.js");
    const token = signAccessToken({ sub: "u", role: "CUSTOMER" });
    expect(() => verifyAccessToken(token + "tampered")).toThrow();
  });

  it("hashes tokens consistently", async () => {
    const { hashToken } = await import("../../src/lib/jwt.js");
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("xyz"));
  });
});