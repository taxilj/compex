import { describe, it, expect } from "vitest";
import { verificationEmail } from "../../src/lib/email.js";

describe("verificationEmail", () => {
  it("embeds the given base URL and token in the verification link", () => {
    const html = verificationEmail("abc123", "https://compex-frontend.vercel.app");
    expect(html).toContain("https://compex-frontend.vercel.app/verify-email?token=abc123");
  });

  it("uses whatever base URL is passed in — no hardcoded fallback", () => {
    const html = verificationEmail("abc123", "https://compex-frontend.vercel.app");
    expect(html).not.toContain("localhost");
  });
});
