"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { listProducts, listCategories, type BackendProduct, type CategoryWithChildren } from "@/lib/api/products";
import { listManufacturers, type ManufacturerListItem } from "@/lib/api/manufacturers";

const PAGE_SIZE = 24;

function ProductSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query] = useState(searchParams.get("q") ?? "");
  const [searchInput, setSearchInput] = useState(query);
  const [manufacturerId, setManufacturerId] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
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

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const mpn = searchInput.trim().toUpperCase();
    if (mpn) router.push(`/products/${encodeURIComponent(mpn)}`);
  };

  return (
    <div className="flex flex-col w-full px-4 md:px-8 py-8 gap-8">
      <section className="overflow-hidden rounded-2xl border border-[#0B1F3A]/10 bg-[#0B1F3A]">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px]">
          <div className="p-6 md:p-8">
            <p className="font-label-sm text-[#afc6ff] uppercase tracking-widest mb-2">Component catalogue</p>
            <h1 className="font-headline-lg text-white mb-3">Product Search</h1>
            <p className="font-body-md text-[#d6e3ff] max-w-2xl mb-6">Search verified electronic components by MPN, description, or manufacturer.</p>
            <form onSubmit={submitSearch} className="relative max-w-2xl">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#44474d]" />
              <input
                aria-label="Search products by MPN, description, or manufacturer"
                className="w-full pl-12 pr-4 py-4 rounded bg-white font-body-md text-[#111c2d] border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#afc6ff] shadow-sm"
                placeholder="Search by exact MPN or part number..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </form>
          </div>
          <div className="relative min-h-48 md:min-h-full">
            <Image
              src="/images/products/circuit-board-detail.jpg"
              alt="Integrated circuits and electronic traces on a circuit board"
              fill
              sizes="(max-width: 767px) 100vw, 280px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1F3A]/35 to-transparent md:bg-none" />
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-72 shrink-0 bg-white p-6 rounded shadow-sm border border-[#E4E7EC] lg:sticky lg:top-4 self-start">
          <div className="flex justify-between items-center pb-4 border-b border-[#E4E7EC] mb-4">
            <h2 className="font-headline-sm text-[#111c2d]">Filters</h2>
            <button
              onClick={() => { setManufacturerId(undefined); setCategoryId(undefined); setPage(1); }}
              className="font-label-sm text-[#1769E0] hover:underline uppercase tracking-wider"
            >
              Clear All
            </button>
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
              <span className="font-label-md text-[#111c2d]">{total}</span> result{total !== 1 ? "s" : ""} found
            </p>
          </div>
          {error && <p className="mb-4 font-body-sm text-[#B42318]" role="alert">{error}</p>}
          <div className="bg-white rounded shadow-sm border border-[#E4E7EC] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="bg-[#f0f3ff]">
                    {["MPN", "Manufacturer", "Category", "Package", "Lifecycle", "Description", "Action"].map((h) => (
                      <th key={h} className="py-3 px-4 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                      <td className="py-3 px-4">
                        <Link href={`/products/${p.mpn}${p.manufacturer?.id ? `?manufacturerId=${encodeURIComponent(p.manufacturer.id)}` : ""}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{p.mpn}</Link>
                      </td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">{p.manufacturer?.name ?? "—"}</td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">{p.category?.name ?? "—"}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">{p.packageType ?? "—"}</td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">{p.lifecycleStatus ?? "—"}</td>
                      <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[250px] truncate">{p.description ?? "—"}</td>
                      <td className="py-3 px-4">
                        <Link href={`/request-quote?mpn=${encodeURIComponent(p.mpn)}&manufacturer=${encodeURIComponent(p.manufacturer?.name ?? "")}`} className="bg-[#1769E0] text-white px-3 py-1.5 rounded font-label-sm text-xs hover:bg-[#1257b8] transition-colors whitespace-nowrap">
                          Request Quote
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && products.length === 0 && (
              <div className="py-16 text-center">
                <p className="font-body-md text-[#44474d]">No products found. Try a different search term or clear the filters.</p>
              </div>
            )}
            {loading && (
              <div className="py-16 text-center">
                <p className="font-body-md text-[#44474d]">Loading products...</p>
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
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
