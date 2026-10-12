import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "../../next.config";

describe("security headers", () => {
  it("sends every required header", () => {
    const keys = securityHeaders.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining([
      "Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Strict-Transport-Security",
    ]));
    expect(securityHeaders.find((h) => h.key === "X-Frame-Options")?.value).toBe("DENY");
    expect(securityHeaders.find((h) => h.key === "X-Content-Type-Options")?.value).toBe("nosniff");
  });

  it("production CSP forbids framing, plugins and eval, and keeps API calls same-origin", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/connect-src[^;]*ws:/);
    expect(csp).not.toMatch(/script-src[^;]*https:/); // no third-party script origins
  });

  it("allows only what the app loads: Google Fonts for Material Symbols and https product images", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' data: https://fonts.gstatic.com");
    expect(csp).toContain("img-src 'self' data: blob: https:");
  });

  it("only the dev policy permits eval and websockets (HMR)", () => {
    const csp = contentSecurityPolicy(true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
  });
});
