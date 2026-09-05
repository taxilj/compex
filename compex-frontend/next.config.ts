import type { NextConfig } from "next";

// Proxy /api/v1/* through this same origin so the API's auth cookies land as
// first-party (browsers increasingly block cross-site cookies). This is a
// server-to-server hop, so it isn't subject to browser CORS at all.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API_BASE}/:path*` },
      { source: "/api/products/:path*", destination: `${API_BASE}/products/:path*` },
    ];
  },
};

export default nextConfig;
