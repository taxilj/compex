import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // API requests are proxied through this same origin (see next.config.ts),
  // so the API's httpOnly access_token cookie is first-party and visible here.
  // This only gates the SSR shell — the API re-validates on every call.
  const token = request.cookies.get("access_token");
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  // Keep the remaining prototypes outside authenticated workflows.
  const { pathname } = request.nextUrl;
  const unsupportedAdminRoutes = [
    "/admin/reports",
  ];
  const unsupportedPortalPrefixes = [
    "/portal/saved",
  ];

  if (unsupportedAdminRoutes.includes(pathname)) return NextResponse.redirect(new URL("/admin", request.url));
  if (unsupportedPortalPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/portal/:path*", "/admin/:path*"] };
