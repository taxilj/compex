"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { listProducts, type BackendProduct } from "@/lib/api/products";
import { useClickOutside } from "@/hooks/useClickOutside";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

interface HeaderSearchProps {
  className?: string;
  onNavigate?: () => void;
}

function productHref(product: BackendProduct): string {
  const params = product.manufacturer ? `?manufacturerId=${encodeURIComponent(product.manufacturer.id)}` : "";
  return `/products/${encodeURIComponent(product.mpn)}${params}`;
}

export default function HeaderSearch({ className, onNavigate }: HeaderSearchProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BackendProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestIdRef = useRef(0);
  const [retryToken, setRetryToken] = useState(0);

  // Single debounced-fetch effect, mirroring the existing debounced search
  // on the manufacturer detail page: all state changes happen inside the
  // setTimeout callback (never synchronously in the effect body), and a
  // `cancelled` flag plus per-request id together guard against both an
  // unmounted/superseded effect and a slower earlier request resolving
  // after a newer one and clobbering fresher results.
  useEffect(() => {
    const term = query.trim();
    let cancelled = false;
    if (term.length < MIN_QUERY_LENGTH) {
      const resetTimer = setTimeout(() => {
        if (cancelled) return;
        setResults([]);
        setError(null);
        setLoading(false);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(resetTimer);
      };
    }
    const timer = setTimeout(() => {
      if (cancelled) return;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      listProducts({ q: term, limit: MAX_RESULTS })
        .then((res) => {
          if (cancelled || requestIdRef.current !== requestId) return;
          setResults(res.data);
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (cancelled || requestIdRef.current !== requestId) return;
          console.error("Header search failed:", err);
          setError("Search failed. Please try again.");
        })
        .finally(() => {
          if (cancelled || requestIdRef.current !== requestId) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, retryToken]);

  useClickOutside(containerRef, () => setOpen(false), open);

  function goToProduct(product: BackendProduct) {
    setOpen(false);
    onNavigate?.();
    router.push(productHref(product));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      goToProduct(results[activeIndex]);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeIndex >= 0 && results[activeIndex]) {
      goToProduct(results[activeIndex]);
      return;
    }
    // Fallback for a user who types the exact MPN and hits Enter before any
    // live results have a chance to load -- exact-match jump, same as the
    // header's original submit-to-navigate behavior.
    const normalized = query.trim().toUpperCase();
    if (normalized) {
      setOpen(false);
      onNavigate?.();
      router.push(`/products/${encodeURIComponent(normalized)}`);
    }
  }

  const trimmedQuery = query.trim();
  const showDropdown = open && trimmedQuery.length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border border-[#E4E7EC] rounded px-3 py-1.5 focus-within:border-[#1769E0] focus-within:ring-1 focus-within:ring-[#1769E0] bg-white"
      >
        {loading ? (
          <Loader2 size={16} className="text-[#75777e] shrink-0 animate-spin" />
        ) : (
          <Search size={16} className="text-[#75777e] shrink-0" />
        )}
        <input
          role="combobox"
          aria-label="Search products by MPN, description, or manufacturer"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="header-search-results"
          aria-activedescendant={activeIndex >= 0 ? `header-search-option-${activeIndex}` : undefined}
          className="w-full bg-transparent border-none outline-none font-mono-label text-[#111c2d] placeholder:text-[#75777e] placeholder:font-body-sm"
          placeholder="Search exact MPN…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </form>

      {showDropdown && (
        <div
          id="header-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 max-h-[60vh] overflow-y-auto bg-white border border-[#E4E7EC] rounded shadow-lg z-50"
        >
          {loading && (
            <p className="px-4 py-3 font-body-sm text-[#44474d] flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </p>
          )}
          {!loading && error && (
            <div className="px-4 py-3 space-y-2">
              <p className="font-body-sm text-[#F04438]" role="alert">{error}</p>
              <button
                type="button"
                onClick={() => setRetryToken((t) => t + 1)}
                className="font-label-sm text-[#1769E0] hover:underline"
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div className="px-4 py-4 space-y-2">
              <p className="font-body-sm text-[#44474d]">No products found for &ldquo;{trimmedQuery}&rdquo;.</p>
              <Link
                href={`/request-quote?mpn=${encodeURIComponent(query.trim())}`}
                className="block font-label-sm text-[#1769E0] hover:underline"
                onClick={() => { setOpen(false); onNavigate?.(); }}
              >
                Can&apos;t find it? Request sourcing →
              </Link>
            </div>
          )}
          {!loading && !error && results.map((product, index) => (
            <button
              key={product.id}
              id={`header-search-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => goToProduct(product)}
              className={`w-full text-left px-4 py-2.5 border-b border-[#E4E7EC] last:border-0 ${
                index === activeIndex ? "bg-[#f0f3ff]" : "hover:bg-[#f9f9ff]"
              }`}
            >
              <p className="font-mono-label text-[#0B1F3A] font-medium text-sm">{product.mpn}</p>
              <p className="font-body-sm text-[#44474d] text-xs truncate">
                {product.manufacturer?.name ?? "Manufacturer not available"}
                {product.description ? ` · ${product.description}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
