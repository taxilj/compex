"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { listProducts, type BackendProduct } from "@/lib/api/products";
import { ProductCard } from "@/components/products/ProductCard";

const FEATURED_LIMIT = 8;

export function FeaturedProducts() {
  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Distinguishes "still loading for the very first time" (render nothing,
  // matching the section's real-data-or-nothing rule) from a retry-in-flight
  // (show a loading affordance instead of yanking the section away again).
  const [everLoaded, setEverLoaded] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    listProducts({ limit: FEATURED_LIMIT })
      .then((res) => {
        if (requestIdRef.current !== requestId) return;
        setProducts(res.data);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        console.error("Failed to load featured products:", err);
        setError(true);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        setLoading(false);
        setEverLoaded(true);
      });
  }, []);

  useEffect(() => {
    // Deferred to a macrotask (matching the rest of this codebase's
    // debounced-fetch convention) so the state changes above never fire
    // synchronously inside this effect's own body.
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const focusSearch = () => {
    const input = document.getElementById("hero-mpn-search") as HTMLInputElement | null;
    input?.focus();
  };

  if (loading && !everLoaded) return null;

  // Every load attempt failed and there's nothing real to show yet -- an
  // honest, retryable error, never a silently empty "successful" catalogue.
  if (error && products.length === 0) {
    return (
      <section className="py-16 px-4 md:px-8 border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto text-center py-8">
          <p className="flex items-center justify-center gap-2 font-body-md text-[#B42318] mb-3" role="alert">
            <AlertCircle size={18} /> Products temporarily unavailable.
          </p>
          <button
            type="button"
            onClick={load}
            className="font-label-md text-[#1769E0] hover:underline"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  // Real catalogue is genuinely empty -- hide the section rather than show a
  // fabricated placeholder grid.
  if (!loading && !error && products.length === 0) return null;

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

        {/* A retry that fails while real products are already showing must
            still surface the failure -- silently keeping stale data with no
            indication is the same class of bug this fix removes. */}
        {!loading && error && products.length > 0 && (
          <p className="flex items-center gap-2 font-body-sm text-[#B42318] mb-4" role="alert">
            <AlertCircle size={14} /> Couldn&apos;t refresh products. Showing previously loaded results.
          </p>
        )}

        {loading ? (
          <p className="flex items-center gap-2 font-body-sm text-[#44474d] py-8 justify-center">
            <Loader2 size={16} className="animate-spin" /> Refreshing products…
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
