"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";

export function CategorySection() {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    listCategories()
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
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

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
          <p className="flex items-center gap-2 font-body-sm text-[#44474d] py-8 justify-center" aria-busy="true">
            <Loader2 size={16} className="animate-spin" /> Loading categories…
          </p>
        )}

        {!loading && error && (
          <div className="text-center py-8">
            <p className="flex items-center justify-center gap-2 font-body-md text-[#B42318] mb-3" role="alert">
              <AlertCircle size={18} /> Categories temporarily unavailable.
            </p>
            <button type="button" onClick={load} className="font-label-md text-[#1769E0] hover:underline">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && categories.length > 0 && (
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
