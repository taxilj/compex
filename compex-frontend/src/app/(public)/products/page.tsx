"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Package } from "lucide-react";
import { listProducts, listCategories, type BackendProduct, type CategoryWithChildren } from "@/lib/api/products";
import { listManufacturers, type ManufacturerListItem } from "@/lib/api/manufacturers";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";

const PAGE_SIZE = 24;

function ProductSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query] = useState(searchParams.get("q") ?? "");
  const [searchInput, setSearchInput] = useState(query);
  const [manufacturerId, setManufacturerId] = useState<string | undefined>(searchParams.get("manufacturerId") ?? undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(searchParams.get("categoryId") ?? undefined);
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [manufacturers, setManufacturers] = useState<ManufacturerListItem[]>([]);
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);

  useEffect(() => {
    listManufacturers({ limit: 100 }).then((r) => setManufacturers(r.data)).catch(() => {});
    listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      listProducts({ q: query || undefined, manufacturerId, categoryId, page, limit: PAGE_SIZE })
        .then((r) => {
          if (cancelled) return;
          setProducts(r.data);
          setTotal(r.total);
        })
        .catch(() => {
          if (!cancelled) setError("Could not load products. Please try again.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [query, manufacturerId, categoryId, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters = Boolean(manufacturerId || categoryId);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const mpn = searchInput.trim().toUpperCase();
    if (mpn) router.push(`/products/${encodeURIComponent(mpn)}`);
  };

  const clearFilters = () => {
    setManufacturerId(undefined);
    setCategoryId(undefined);
    setPage(1);
  };

  return (
    <div className="flex flex-col w-full px-4 md:px-8 py-8 gap-6">
      <nav className="flex items-center gap-2 font-label-sm text-[#44474d] text-xs" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#1769E0]">Home</Link><span>/</span>
        <span className="text-[#111c2d]">Products</span>
      </nav>

      <section className="border-b border-[#E4E7EC] pb-8">
        <p className="font-mono-label text-[#1769E0] uppercase tracking-wider text-xs mb-2">Component catalogue</p>
        <h1 className="font-headline-lg text-[#0B1F3A] mb-3">Product Search</h1>
        <p className="font-body-md text-[#44474d] max-w-2xl mb-6">Search verified electronic components by exact MPN, description, or manufacturer.</p>
        <form onSubmit={submitSearch} className="relative max-w-2xl">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#75777e]" />
          <input
            aria-label="Search products by MPN, description, or manufacturer"
            className="w-full pl-12 pr-4 py-3.5 rounded border border-[#E4E7EC] font-mono-label text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#1769E0] focus:border-[#1769E0]"
            placeholder="Search by exact MPN or part number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
      </section>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-72 shrink-0 bg-white p-6 rounded shadow-sm border border-[#E4E7EC] lg:sticky lg:top-4 self-start">
          <div className="flex justify-between items-center pb-4 border-b border-[#E4E7EC] mb-4">
            <h2 className="font-headline-sm text-[#111c2d]">Filters</h2>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="font-label-sm text-[#1769E0] hover:underline uppercase tracking-wider">
                Clear All
              </button>
            )}
          </div>
          <FilterGroup label="Category">
            {categories.map((c) => (
              <CheckItem key={c.id} label={c.name} checked={categoryId === c.id} onChange={() => { setCategoryId(categoryId === c.id ? undefined : c.id); setPage(1); }} />
            ))}
            {categories.length === 0 && <p className="font-body-sm text-[#44474d]">No categories yet</p>}
          </FilterGroup>
          <FilterGroup label="Manufacturer">
            {manufacturers.map((m) => (
              <CheckItem key={m.id} label={m.name} checked={manufacturerId === m.id} onChange={() => { setManufacturerId(manufacturerId === m.id ? undefined : m.id); setPage(1); }} />
            ))}
            {manufacturers.length === 0 && <p className="font-body-sm text-[#44474d]">No manufacturers yet</p>}
          </FilterGroup>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="font-body-sm text-[#44474d]">
              {!loading && (
                <>
                  <span className="font-label-md text-[#111c2d]">{total}</span> result{total !== 1 ? "s" : ""} found
                </>
              )}
            </p>
          </div>

          {error && (
            <div className="border border-[#F04438]/30 bg-[#F04438]/5 rounded-xl px-6 py-4 mb-4" role="alert">
              <p className="font-body-sm text-[#B42318]">{error}</p>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4" aria-busy="true" aria-label="Loading products">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="border border-[#E4E7EC] rounded bg-white overflow-hidden">
                  <div className="aspect-square bg-[#f0f3ff] animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-16 bg-[#f0f3ff] rounded animate-pulse" />
                    <div className="h-4 w-24 bg-[#f0f3ff] rounded animate-pulse" />
                    <div className="h-3 w-full bg-[#f0f3ff] rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="text-center py-16 border border-dashed border-[#E4E7EC] rounded-xl">
              <p className="font-headline-sm text-[#0B1F3A] mb-2">No products found</p>
              <p className="font-body-sm text-[#44474d] mb-6 max-w-md mx-auto">
                Try a different search term, or clear your filters. You can also search an exact MPN directly — we check live availability even when it isn&apos;t in our catalogue yet.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="border border-[#0B1F3A] text-[#0B1F3A] px-5 py-2.5 rounded font-label-md hover:bg-[#0B1F3A] hover:text-white transition-colors">
                    Clear Filters
                  </button>
                )}
                <Link href="/request-quote" className="bg-[#1769E0] text-white px-5 py-2.5 rounded font-label-md hover:bg-[#1257b8] transition-colors">
                  Request a Quote
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded border border-[#E4E7EC] font-label-sm text-[#111c2d] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f0f3ff]"
              >
                Previous
              </button>
              <span className="font-body-sm text-[#44474d]">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded border border-[#E4E7EC] font-label-sm text-[#111c2d] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f0f3ff]"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: BackendProduct }) {
  const detailHref = `/products/${encodeURIComponent(product.mpn)}${product.manufacturer?.id ? `?manufacturerId=${encodeURIComponent(product.manufacturer.id)}` : ""}`;
  const quoteHref = `/request-quote?mpn=${encodeURIComponent(product.mpn)}&manufacturer=${encodeURIComponent(product.manufacturer?.name ?? "")}`;
  const image = product.images[0];

  return (
    <div className="group bg-white border border-[#E4E7EC] rounded flex flex-col hover:border-[#1769E0] transition-colors">
      <Link href={detailHref} className="flex flex-col flex-1 min-w-0">
        <div className="aspect-square w-full bg-[#f0f3ff] border-b border-[#E4E7EC] flex items-center justify-center overflow-hidden">
          <ImageWithFallback
            src={image}
            alt={product.name ?? product.mpn}
            className="w-full h-full object-contain p-4"
            fallback={<Package size={32} className="text-[#0B1F3A]/20" />}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1.5 p-4">
          {product.category && (
            <span className="font-label-sm text-[#1769E0] uppercase tracking-wider text-[10px] truncate">{product.category.name}</span>
          )}
          <p className="font-mono text-[17px] font-bold text-[#0B1F3A] leading-tight break-words">{product.mpn}</p>
          <p className="font-label-md text-[#273143] break-words">{product.manufacturer?.name ?? "—"}</p>
          <p className="font-body-sm text-[#44474d]/80 line-clamp-2">{product.description ?? "No description available."}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {product.packageType && <span className="tag">{product.packageType}</span>}
            {product.lifecycleStatus && <span className="font-body-sm text-[#44474d] text-xs">{product.lifecycleStatus}</span>}
          </div>
          <p className="font-body-sm text-[#44474d] text-xs mt-0.5">
            {product.datasheetUrl ? "Datasheet available" : "Datasheet unavailable"}
          </p>
        </div>
      </Link>
      <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-2">
        <Link href={detailHref} className="font-label-md text-[#1769E0] text-sm hover:underline">
          View Product
        </Link>
        <Link
          href={quoteHref}
          className="bg-[#1769E0] text-white px-3 py-1.5 rounded font-label-sm text-xs hover:bg-[#1257b8] transition-colors whitespace-nowrap"
        >
          Request Quote
        </Link>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="font-label-md text-[#44474d] uppercase tracking-wider mb-3">{label}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group" onClick={onChange}>
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? "bg-[#0B1F3A] border-[#0B1F3A]" : "border-[#c4c6ce] group-hover:border-[#0B1F3A]"}`}
      >
        {checked && <span className="text-white text-xs">✓</span>}
      </div>
      <span className="font-body-sm text-[#111c2d]">{label}</span>
    </label>
  );
}

export default function ProductSearchPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 font-body-md text-[#44474d]">Loading products...</div>}>
      <ProductSearchContent />
    </Suspense>
  );
}
