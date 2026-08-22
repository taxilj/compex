import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // The real auth cookies are set on the API's own (cross-site) domain and
  // are not visible here — this checks a first-party marker set on login
  // instead (see lib/api/auth.ts). Actual authorization is enforced by the
  // API on every request regardless of this check.
  const token = request.cookies.get("cx_session");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
