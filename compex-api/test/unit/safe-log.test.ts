import { describe, expect, it } from "vitest";
import { describeError, safeErr } from "../../src/lib/safe-log.js";
import { describeRedisError } from "../../src/lib/redis-options.js";

const SECRET = "synthetic-secret customer@example.com +91 98765 43210 postgresql://u:p@host/db";

describe("safe error logging", () => {
  it("never carries the message, stack, cause or hostnames of a raw error", () => {
    const err = Object.assign(new Error(SECRET), { code: "P2002", hostname: "private-host", response: SECRET, cause: new Error(SECRET) });
    const out = JSON.stringify(safeErr(err)) + describeError(err);
    expect(out).toContain("P2002");
    for (const leak of ["synthetic-secret", "customer@example.com", "98765", "postgresql://", "private-host"]) {
      expect(out).not.toContain(leak);
    }
  });

  it("keeps only well-formed short codes and numeric statuses", () => {
    expect(safeErr(Object.assign(new Error("x"), { code: "has spaces and customer@example.com" })).code).toBeUndefined();
    expect(safeErr({ name: "NoSuchBucket", $metadata: { httpStatusCode: 404 } })).toEqual({ errorName: "NoSuchBucket", code: undefined, statusCode: 404 });
    expect(describeError("a bare string with customer@example.com")).toBe("Error");
    expect(describeError(null)).toBe("Error");
  });

  it("classifies Redis failures without echoing usage numbers or hosts", () => {
    expect(describeRedisError(new Error("ERR max requests limit exceeded. Limit: 500000, Usage: 500002"))).toBe("quota-exceeded");
    expect(describeRedisError(Object.assign(new Error("connect ECONNREFUSED 10.1.2.3:6379"), { code: "ECONNREFUSED" }))).toBe("ECONNREFUSED");
    expect(describeRedisError(new Error("anything else customer@example.com"))).toBe("unavailable");
  });
});
