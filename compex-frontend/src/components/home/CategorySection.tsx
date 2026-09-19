"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { listCategories, peekCategories, type CategoryWithChildren } from "@/lib/api/products";

const SLOW_HINT_MS = 4_000;
const SKELETON_CARDS = 4;

export function CategorySection() {
  // Paint the last good copy instantly (stale-while-revalidate); the refresh
  // below replaces it, and a failed refresh keeps showing it.
  const [categories, setCategories] = useState<CategoryWithChildren[]>(() => peekCategories() ?? []);
  const [loading, setLoading] = useState(() => peekCategories() === null);
  const [error, setError] = useState(false);
  const [slow, setSlow] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback((force = false) => {
    const requestId = ++requestIdRef.current;
    setError(false);
    listCategories({ force })
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setCategories(data);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        console.error("Failed to load categories:", err);
        setError(true);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setLoading(false);
        setSlow(false);
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => {
      clearTimeout(timer);
      requestIdRef.current++; // ignore results after unmount
    };
  }, [load]);

  // A cold-starting backend can take many seconds: say so instead of looking frozen.
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const retry = () => {
    setLoading(true);
    load(true);
  };

  const showError = !loading && error && categories.length === 0;

  // Real taxonomy only: once loaded, hide the section entirely if the
  // catalogue genuinely has no categories -- never invent placeholder cards.
  if (!loading && !error && categories.length === 0) return null;

  return (
    <section className="py-16 px-4 md:px-8 border-b border-[#E4E7EC]">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-headline-lg text-[#0B1F3A]">Browse by Category</h2>
          <Link href="/categories" className="font-label-md text-[#1769E0] hover:underline whitespace-nowrap">View all →</Link>
        </div>

        {loading && (
          <div aria-busy="true">
            <p className="sr-only" role="status">Loading categories…</p>
            <div
              className="grid gap-px bg-[#E4E7EC] border border-[#E4E7EC]"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
              aria-hidden="true"
            >
              {Array.from({ length: SKELETON_CARDS }, (_, i) => (
                <div key={i} className="bg-white p-5">
                  <div className="h-4 w-2/3 bg-[#E4E7EC] animate-pulse" />
                  <div className="h-3 w-1/3 bg-[#eef0f4] animate-pulse mt-3" />
                </div>
              ))}
            </div>
            {slow && (
              <p className="flex items-center justify-center gap-2 font-body-sm text-[#44474d] pt-4">
                <Loader2 size={14} className="animate-spin" /> Still waiting for the server — it may be waking up.
              </p>
            )}
          </div>
        )}

        {showError && (
          <div className="text-center py-8">
            <p className="flex items-center justify-center gap-2 font-body-md text-[#B42318] mb-3" role="alert">
              <AlertCircle size={18} /> Categories temporarily unavailable.
            </p>
            <button type="button" onClick={retry} className="font-label-md text-[#1769E0] hover:underline">
              Retry
            </button>
          </div>
        )}

        {!loading && categories.length > 0 && (
          // auto-fit + minmax fills the row with however many cards actually
          // exist instead of reserving a fixed column count -- 2 categories
          // stretch to fill the width instead of leaving empty grey tracks.
          <div
            className="grid gap-px bg-[#E4E7EC] border border-[#E4E7EC]"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
          >
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?categoryId=${encodeURIComponent(cat.id)}`}
                className="bg-white p-5 hover:bg-[#f0f3ff] transition-colors group"
              >
                <h3 className="font-label-md text-[#111c2d] group-hover:text-[#1769E0]">{cat.name}</h3>
                <p className="font-body-sm text-[#44474d] mt-1">{cat._count.products} product{cat._count.products !== 1 ? "s" : ""}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
