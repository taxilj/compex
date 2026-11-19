"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center" role="alert">
      <h1 className="font-headline-lg mb-3">Something went wrong</h1>
      <p className="mb-6">This page could not be loaded. Please try again.</p>
      <div className="flex flex-wrap justify-center gap-4">
        <Button onClick={retry}>Try again</Button>
        <Link href="/" className="text-[#1769E0] underline">Go to homepage</Link>
      </div>
    </div>
  );
}
