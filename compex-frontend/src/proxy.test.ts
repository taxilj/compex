import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { proxy } from "./proxy";

const responses = vi.hoisted(() => ({ next: vi.fn(() => "next"), redirect: vi.fn((url: URL) => url.pathname) }));
vi.mock("next/server", () => ({ NextResponse: responses }));
beforeEach(() => vi.clearAllMocks());
const routes = ["/admin/orders", "/admin/purchase-orders", "/admin/invoices", "/admin/shipments", "/portal/orders", "/portal/orders/example", "/portal/invoices", "/portal/invoices/example", "/portal/shipments", "/portal/shipments/example"];
function request(path: string, signedIn: boolean): NextRequest {
  return { url: `http://localhost${path}`, nextUrl: { pathname: path }, cookies: { get: () => signedIn ? { value: "test-cookie-presence" } : undefined } } as unknown as NextRequest;
}
describe("ERPNext-owned document routing", () => {
  it.each(routes)("%s keeps its sign-in gate", path => {
    expect(proxy(request(path, false))).toBe("/login");
    expect(responses.next).not.toHaveBeenCalled();
  });
  it.each(routes)("%s can show its document handoff notice after the cookie gate", path => {
    expect(proxy(request(path, true))).toBe("next");
    expect(responses.redirect).not.toHaveBeenCalled();
  });
  it.each([["/admin/reports", "/admin"], ["/portal/saved", "/portal"], ["/portal/saved/example", "/portal"]])("%s still blocks the unrelated prototype", (path, dashboard) => {
    expect(proxy(request(path, true))).toBe(dashboard);
  });
});
