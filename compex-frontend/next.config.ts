import type { NextConfig } from "next";

// Proxy /api/v1/* through this same origin so the API's auth cookies land as
// first-party (browsers increasingly block cross-site cookies). This is a
// server-to-server hop, so it isn't subject to browser CORS at all.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy, sized to what the app really loads:
// - scripts: Next.js App Router emits inline bootstrap scripts, so 'unsafe-inline'
//   is required unless every page moves to per-request nonces (which would make
//   the static catalogue pages dynamic). 'unsafe-eval' is dev-only (HMR).
// - styles/fonts: the Material Symbols stylesheet is loaded from Google Fonts;
//   Inter is self-hosted by next/font.
// - images: supplier product images come from several CDNs, so any https origin.
// - connect: every API call is same-origin via the rewrites above; ws: is dev HMR.
export function contentSecurityPolicy(dev = isDev): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Same value Vercel already serves in production; stated here so it also holds elsewhere.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API_BASE}/:path*` },
      { source: "/api/products/:path*", destination: `${API_BASE}/products/:path*` },
    ];
  },
};

export default nextConfig;
