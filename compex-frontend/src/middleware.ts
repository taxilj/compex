import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // API requests are proxied through this same origin (see next.config.ts),
  // so the API's httpOnly access_token cookie is first-party and visible
  // here. This only gates the SSR shell — the API re-validates on every call.
  const token = request.cookies.get("access_token");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
