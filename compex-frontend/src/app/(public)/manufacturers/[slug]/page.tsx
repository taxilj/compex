"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getManufacturer } from "@/lib/api/manufacturers";
import type { BackendManufacturer, BackendProduct } from "@/lib/api/products";
import { ApiError } from "@/lib/api/client";
import { Package } from "lucide-react";

export default function ManufacturerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [manufacturer, setManufacturer] = useState<BackendManufacturer | null>(null);
  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getManufacturer(slug, { limit: 50 })
      .then((r) => {
        if (cancelled) return;
        setManufacturer(r.manufacturer);
        setProducts(r.products.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 404) setNotFound(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

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
        <div className="max-w-[1280px] mx-auto flex items-center gap-6">
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
      </section>

      <section className="py-16 px-4 md:px-8 max-w-[1280px] mx-auto">
        {manufacturer.description && <p className="font-body-md text-[#44474d] mb-10 max-w-3xl">{manufacturer.description}</p>}

        <h2 className="font-headline-md text-[#0B1F3A] mb-6">Products from {manufacturer.name}</h2>
        {products.length === 0 ? (
          <p className="font-body-md text-[#44474d]">No products listed for this manufacturer yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.mpn}`}
                className="bg-white border border-[#E4E7EC] rounded-xl p-5 hover:border-[#1769E0] hover:shadow-md transition-all flex gap-4"
              >
                <div className="w-12 h-12 rounded bg-[#f0f3ff] flex items-center justify-center shrink-0">
                  <Package size={20} className="text-[#0B1F3A]/40" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono-label text-[#1769E0] text-sm font-medium truncate">{p.mpn}</p>
                  <p className="font-body-sm text-[#44474d] truncate">{p.name ?? p.description ?? "—"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
