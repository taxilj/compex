"use client";

import Link from "next/link";
import { useEffect } from "react";
import { COMPANY_EMAIL } from "@/lib/constants/contact";

// Last-resort boundary when the root layout itself fails. It must render its own <html>, so it uses
// plain markup and inline styles only (plus next/link): no shared components, fonts or stylesheets
// that could be the thing that broke.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(`[global-error] render failed${error.digest ? ` (digest ${error.digest})` : ""}`);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F7F9FC", color: "#0B1F3A" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 16px", textAlign: "center" }} role="alert">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/compex-logo.jpeg" alt="Compex Solution" width={140} height={96} style={{ height: 56, width: "auto", marginBottom: 24 }} />
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ color: "#44474d", margin: "0 0 28px", lineHeight: 1.6 }}>
            The site could not be displayed. Please try again; if the problem continues, email {COMPANY_EMAIL}.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#1769E0", color: "#fff", border: 0, borderRadius: 8, padding: "12px 24px", fontSize: 16, cursor: "pointer", marginRight: 12 }}
          >
            Try again
          </button>
          <Link href="/" style={{ color: "#1769E0", fontSize: 16 }}>
            Back to Home
          </Link>
        </main>
      </body>
    </html>
  );
}
