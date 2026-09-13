"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { getManufacturer } from "@/lib/api/manufacturers";
import { listProducts, type BackendManufacturer, type BackendProduct } from "@/lib/api/products";
import { ApiError } from "@/lib/api/client";
import { Package, Search } from "lucide-react";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";

export default function ManufacturerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [manufacturer, setManufacturer] = useState<BackendManufacturer | null>(null);
  const [defaultProducts, setDefaultProducts] = useState<BackendProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<BackendProduct[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getManufacturer(slug, { limit: 50 })
      .then((r) => {
        if (cancelled) return;
        setManufacturer(r.manufacturer);
        setDefaultProducts(r.products.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 404) setNotFound(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  // Search within this manufacturer — reuses the existing product-listing
  // endpoint with manufacturerId + q, same filters used on /products.
  useEffect(() => {
    if (!manufacturer) return;
    const term = searchTerm.trim();
    if (term === "") return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setSearching(true);
      listProducts({ manufacturerId: manufacturer.id, q: term, limit: 50 })
        .then((r) => {
          if (cancelled) return;
          setSearchResults(r.data);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [manufacturer, searchTerm]);

  const products = searchResults ?? defaultProducts;

  // Categories actually represented among this manufacturer's loaded
  // products — derived from real data, never a separate invented list.
  const categories = useMemo(() => {
    const names = new Set<string>();
    defaultProducts.forEach((p) => { if (p.category?.name) names.add(p.category.name); });
    return Array.from(names);
  }, [defaultProducts]);

  if (loading) {
    return <div className="max-w-[1280px] mx-auto px-6 py-12 font-body-md text-[#44474d]">Loading manufacturer...</div>;
  }

  if (notFound || !manufacturer) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-12 text-center">
        <h1 className="font-headline-lg text-[#111c2d] mb-3">Manufacturer not found</h1>
        <Link href="/manufacturers" className="text-[#1769E0] hover:underline font-label-md">Back to manufacturers</Link>
      </div>
    );
  }

  return (
    <div>
      <section className="py-16 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <nav className="flex items-center gap-2 font-label-sm text-[#7587a7] text-xs mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link><span>/</span>
            <Link href="/manufacturers" className="hover:text-white">Manufacturers</Link><span>/</span>
            <span className="text-white">{manufacturer.name}</span>
          </nav>
          <div className="flex items-center gap-6">
            {manufacturer.logoUrl && (
              <div className="w-16 h-16 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={manufacturer.logoUrl} alt={manufacturer.name} className="w-full h-full object-contain" />
              </div>
            )}
            <div>
              <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-2">Manufacturer</p>
              <h1 className="font-display-lg text-white mb-2">{manufacturer.name}</h1>
              {manufacturer.country && <p className="font-body-sm text-[#7587a7]">{manufacturer.country}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 max-w-[1280px] mx-auto">
        {manufacturer.description && <p className="font-body-md text-[#44474d] mb-8 max-w-3xl">{manufacturer.description}</p>}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {categories.map((cat) => (
              <span key={cat} className="tag">{cat}</span>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="font-headline-md text-[#0B1F3A]">Products from {manufacturer.name}</h2>
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#75777e]" />
            <input
              aria-label={`Search products from ${manufacturer.name}`}
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                if (value.trim() === "") setSearchResults(null);
              }}
              placeholder="Search within this manufacturer..."
              className="w-full pl-9 pr-3 py-2.5 border border-[#E4E7EC] rounded font-body-sm text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#1769E0] focus:border-[#1769E0]"
            />
          </div>
        </div>

        {searching && <p className="font-body-sm text-[#44474d] mb-4">Searching…</p>}

        {products.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#E4E7EC] rounded-xl">
            <p className="font-body-md text-[#44474d]">
              {searchResults !== null ? "No products match your search." : "No products listed for this manufacturer yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/products/${encodeURIComponent(p.mpn)}`}
                className="group bg-white border border-[#E4E7EC] rounded flex flex-col hover:border-[#1769E0] transition-colors"
              >
                <div className="aspect-square w-full bg-[#f0f3ff] border-b border-[#E4E7EC] flex items-center justify-center overflow-hidden">
                  <ImageWithFallback
                    src={p.images[0]}
                    alt={p.name ?? p.mpn}
                    className="w-full h-full object-contain p-4"
                    fallback={<Package size={28} className="text-[#0B1F3A]/20" />}
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1.5 p-4">
                  {p.category && (
                    <span className="font-label-sm text-[#1769E0] uppercase tracking-wider text-[10px] truncate">{p.category.name}</span>
                  )}
                  <p className="font-mono text-[16px] font-bold text-[#0B1F3A] leading-tight break-words">{p.mpn}</p>
                  <p className="font-body-sm text-[#44474d]/80 line-clamp-2">{p.description ?? "No description available."}</p>
                  {p.packageType && <span className="tag mt-1 self-start">{p.packageType}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
