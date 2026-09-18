"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { Search, AlertCircle } from "lucide-react";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";
import CTABanner from "@/components/ui/CTABanner";

function matchesQuery(category: CategoryWithChildren, q: string): boolean {
  if (q === "") return true;
  if (category.name.toLowerCase().includes(q)) return true;
  return category.children.some((child) => child.name.toLowerCase().includes(q));
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithChildren[] | null>(null);
  const [error, setError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!categories) return [];
    const q = query.trim().toLowerCase();
    return categories.filter((c) => matchesQuery(c, q));
  }, [categories, query]);

  useEffect(() => {
    let active = true;
    listCategories()
      .then((data) => { if (active) setCategories(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retryToken]);

  function retryCategories() {
    setCategories(null);
    setError(false);
    setRetryToken((value) => value + 1);
  }

  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <nav className="flex items-center gap-2 font-label-sm text-[#7587a7] text-xs mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link><span>/</span>
            <span className="text-white">Categories</span>
          </nav>
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Categories</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Browse by Category
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Explore the Compex catalogue by component category, or search an exact part number directly if you already know what you need.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          {categories === null && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading categories">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-[#f0f3ff] animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-16 border border-dashed border-[#F04438]/30 rounded-xl">
              <p className="flex items-center justify-center gap-2 font-headline-sm text-[#B42318] mb-2" role="alert"><AlertCircle size={18} /> Categories are temporarily unavailable</p>
              <p className="font-body-sm text-[#44474d] mb-6">Please retry rather than relying on an incomplete category list.</p>
              <button type="button" onClick={retryCategories} className="inline-flex items-center bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8]">Retry</button>
            </div>
          )}

          {!error && categories !== null && categories.length === 0 && (
            <div className="text-center py-16 border border-dashed border-[#E4E7EC] rounded-xl">
              <p className="font-headline-sm text-[#0B1F3A] mb-2">No categories in the catalogue yet</p>
              <p className="font-body-sm text-[#44474d] mb-6 max-w-md mx-auto">
                Search an exact MPN to check live availability across our sourcing network, or submit your requirement directly.
              </p>
              <Link href="/products" className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors">
                Search a Component
              </Link>
            </div>
          )}

          {/* DigiKey-style Product Index: a search-within box, a jump list of
              top-level categories, and a dense two-column subcategory list
              with counts -- fast to scan, unlike a sparse card grid. */}
          {!error && categories !== null && categories.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-10">
              <aside className="lg:w-64 shrink-0">
                <div className="lg:sticky lg:top-32">
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#75777e]" />
                    <input
                      aria-label="Search categories"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search within..."
                      className="w-full pl-9 pr-3 py-2.5 border border-[#E4E7EC] rounded font-body-sm text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#1769E0] focus:border-[#1769E0]"
                    />
                  </div>
                  <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-2">Categories</p>
                  <ul className="max-h-[60vh] overflow-y-auto border-t border-[#E4E7EC]">
                    {filtered.map((cat) => (
                      <li key={cat.id} className="border-b border-[#E4E7EC]">
                        <a href={`#category-${cat.id}`} className="block py-2 font-body-sm text-[#1769E0] hover:underline">
                          {cat.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>

              <div className="flex-1 min-w-0 space-y-10">
                {filtered.length === 0 && (
                  <p className="font-body-md text-[#44474d] py-12 text-center">No categories match your search.</p>
                )}
                {filtered.map((cat) => (
                  <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-32">
                    <div className="flex items-baseline justify-between gap-4 border-b border-[#E4E7EC] pb-2 mb-3">
                      <Link href={`/products?categoryId=${encodeURIComponent(cat.id)}`} className="font-headline-sm text-[#0B1F3A] hover:text-[#1769E0]">
                        {cat.name}
                      </Link>
                      <span className="font-mono-label text-[#75777e] text-xs shrink-0">
                        {cat._count.products} item{cat._count.products !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {cat.children.length > 0 ? (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                        {cat.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/products?categoryId=${encodeURIComponent(child.id)}`}
                              className="flex items-baseline justify-between gap-2 py-1 font-body-sm text-[#111c2d] hover:text-[#1769E0] hover:underline"
                            >
                              <span className="truncate">{child.name}</span>
                              <span className="font-mono-label text-[#75777e] text-xs shrink-0">{child._count.products}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Link href={`/products?categoryId=${encodeURIComponent(cat.id)}`} className="font-label-md text-[#1769E0] hover:underline">
                        Browse all {cat.name} →
                      </Link>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-4">Don&apos;t see the right category?</h2>
          <p className="font-body-lg text-[#44474d] mb-8 max-w-2xl mx-auto">
            Search an exact MPN directly — we check live availability across our sourcing network even for parts not yet in our catalogue.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors"
          >
            Search a Component
          </Link>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
