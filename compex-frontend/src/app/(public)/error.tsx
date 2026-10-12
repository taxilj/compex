"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

// Route-level error boundary for the public site. The message is generic on purpose: raw error text
// can carry internals, so only Next's opaque digest is logged for correlation with server logs.
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(`[public-error] render failed${error.digest ? ` (digest ${error.digest})` : ""}`);
  }, [error]);

  return (
    <section className="max-w-2xl mx-auto px-4 md:px-8 py-20 text-center" role="alert">
      <AlertCircle size={36} className="mx-auto mb-4 text-[#B42318]" aria-hidden="true" />
      <h1 className="font-headline-md text-[#0B1F3A] mb-3">Something went wrong</h1>
      <p className="font-body-md text-[#44474d] mb-8">
        This page could not be displayed. Please try again; if the problem continues, contact us and we&apos;ll help.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded-lg font-label-md hover:bg-[#1257b8] transition-colors"
        >
          <RotateCw size={16} aria-hidden="true" /> Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center border border-[#1769E0] text-[#1769E0] px-6 py-3 rounded-lg font-label-md hover:bg-[#e8eeff] transition-colors"
        >
          Back to Home
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center border border-[#E4E7EC] text-[#0B1F3A] px-6 py-3 rounded-lg font-label-md hover:border-[#1769E0] transition-colors"
        >
          Contact us
        </Link>
      </div>
    </section>
  );
}
