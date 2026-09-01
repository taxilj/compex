import { describe, it, expect } from "vitest";
import { withTimeout, TimeoutError } from "../../src/lib/async.js";

function delay<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function neverResolves<T>(): Promise<T> {
  return new Promise<T>(() => {
    /* intentionally never settles -- simulates a hung SMTP socket */
  });
}

describe("withTimeout", () => {
  it("resolves with the underlying value when the promise settles in time", async () => {
    await expect(withTimeout(delay(5, "ok"), 200, "test op")).resolves.toBe("ok");
  });

  it("rejects with a TimeoutError once the deadline passes, even if the promise never settles", async () => {
    await expect(withTimeout(neverResolves(), 20, "hung provider")).rejects.toThrow(TimeoutError);
    await expect(withTimeout(neverResolves(), 20, "hung provider")).rejects.toThrow(/hung provider timed out after 20ms/);
  });

  it("propagates the underlying rejection when the promise fails before the deadline", async () => {
    const failing = Promise.reject(new Error("SMTP auth rejected"));
    await expect(withTimeout(failing, 200, "test op")).rejects.toThrow("SMTP auth rejected");
  });

  it("does not fire the timeout after the promise has already resolved", async () => {
    const result = await withTimeout(delay(5, "fast"), 500, "test op");
    expect(result).toBe("fast");
    // If the timer weren't cleared, nothing observable would break here --
    // this mainly documents intent. The real protection is the unref() call
    // (checked implicitly: this test process exits promptly).
  });
});
