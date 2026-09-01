import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // API requests are proxied through this same origin (see next.config.ts),
  // so the API's httpOnly access_token cookie is first-party and visible here.
  // This only gates the SSR shell — the API re-validates on every call.
  const token = request.cookies.get("access_token");
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  // These legacy prototypes render hard-coded commercial data. Keep them out
  // of authenticated workflows until matching API-backed modules exist.
  const { pathname } = request.nextUrl;
  const unsupportedAdminRoutes = [
    "/admin/customers", "/admin/invoices", "/admin/orders", "/admin/products",
    "/admin/purchase-orders", "/admin/reports", "/admin/shipments",
  ];
  const unsupportedPortalPrefixes = [
    "/portal/invoices", "/portal/orders", "/portal/saved", "/portal/shipments",
  ];

  if (unsupportedAdminRoutes.includes(pathname)) return NextResponse.redirect(new URL("/admin", request.url));
  if (unsupportedPortalPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }
  if (pathname === "/portal/quotes/compare" || /^\/portal\/rfqs\/[^/]+\/bom$/.test(pathname)) {
    return NextResponse.redirect(new URL(pathname === "/portal/quotes/compare" ? "/portal/quotes" : "/portal/rfqs", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/portal/:path*", "/admin/:path*"] };
