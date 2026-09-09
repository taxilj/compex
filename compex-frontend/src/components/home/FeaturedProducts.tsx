"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import { lookupPublicProduct, type PublicProduct } from "@/lib/api/products";

// Representative, pre-verified MPNs spanning common component families.
// Each is resolved through the same exact-MPN lookup used by /products/[mpn]
// (backend-cached — repeat lookups hit cache, no extra provider load per
// visitor). A card only renders if the lookup returns a real product; no
// fallback data is ever fabricated.
const FEATURED_MPNS = [
  "STM32F103C8T6",
  "PIC16F877A-I/P",
  "LM324N",
  "TLC555CP",
  "L7805CV",
  "ULN2803A",
  "2N7002",
  "1N5822",
];

function findSpec(product: PublicProduct, namePattern: RegExp): string | undefined {
  return product.specifications.find((s) => namePattern.test(s.name))?.value;
}

// Session-scoped cache so repeat homepage visits/reloads in the same tab
// don't re-issue 8 parallel lookups every time — this is what actually
// bounds provider load per browser, on top of the backend's own lookup
// cache. 15 min is long enough to absorb normal browsing/refresh behavior
// for content that's illustrative, not live inventory.
const CACHE_KEY = "compex_featured_products_v1";
const CACHE_TTL_MS = 15 * 60 * 1000;

function readCache(): PublicProduct[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { timestamp, products } = JSON.parse(raw) as { timestamp: number; products: PublicProduct[] };
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return products;
  } catch {
    return null;
  }
}

function writeCache(products: PublicProduct[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), products }));
  } catch {
    // Private browsing / storage disabled — fall through silently, caching is an optimization, not a requirement.
  }
}

export function FeaturedProducts() {
  const [products, setProducts] = useState<PublicProduct[] | null>(() => readCache());

  useEffect(() => {
    if (products !== null) return;

    let cancelled = false;
    Promise.all(
      FEATURED_MPNS.map((mpn) =>
        lookupPublicProduct(mpn)
          .then((r) => r.product)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      const found = results.filter((p): p is PublicProduct => p !== null);
      setProducts(found);
      writeCache(found);
    });
    return () => {
      cancelled = true;
    };
  }, [products]);

  const focusSearch = () => {
    const input = document.getElementById("hero-mpn-search") as HTMLInputElement | null;
    input?.focus();
  };

  // Loading: render nothing rather than a placeholder skeleton grid — avoids
  // layout shift risk on first paint while keeping the section absent until
  // there's real data to show (no fabricated "loading" cards).
  if (products === null) return null;

  // Every curated MPN failed to resolve — hide the section rather than show
  // an empty/broken grid. Real-data-or-nothing, per the redesign's rule.
  if (products.length === 0) return null;

  return (
    <section className="py-16 px-4 md:px-8 border-b border-[#E4E7EC]">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <h2 className="font-headline-lg text-[#0B1F3A] mb-2">Explore Electronic Components</h2>
            <p className="font-body-md text-[#44474d] max-w-xl">
              Search exact part numbers or browse representative components across semiconductors, connectors, passives, sensors, and power devices.
            </p>
          </div>
          <button
            type="button"
            onClick={focusSearch}
            className="font-label-md text-[#1769E0] hover:underline whitespace-nowrap text-left sm:text-right"
          >
            Can&apos;t find your part? Search any exact MPN.
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => {
            const packageSpec = findSpec(product, /package/i);
            return (
              <Link
                key={product.mpn}
                href={`/products/${encodeURIComponent(product.mpn)}`}
                className="group flex flex-col border border-[#E4E7EC] rounded bg-white hover:border-[#1769E0] transition-colors"
              >
                <div className="aspect-square w-full bg-[#f0f3ff] border-b border-[#E4E7EC] flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-contain p-4" />
                  ) : (
                    <Package size={32} className="text-[#0B1F3A]/20" />
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1.5 p-4">
                  {product.category && (
                    <span className="font-label-sm text-[#1769E0] uppercase tracking-wider text-[10px] truncate">{product.category}</span>
                  )}
                  <p className="font-mono text-[17px] font-bold text-[#0B1F3A] leading-tight break-words">{product.mpn}</p>
                  <p className="font-label-md text-[#273143] break-words">{product.manufacturer}</p>
                  <p className="font-body-sm text-[#44474d]/80 line-clamp-2">{product.productName}</p>
                  {packageSpec && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="tag">{packageSpec}</span>
                    </div>
                  )}
                  <span className="mt-auto pt-3 font-label-md text-[#1769E0] flex items-center gap-1.5 text-sm">
                    View Product
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
