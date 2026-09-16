"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { listProducts, type BackendProduct, type CategoryWithChildren } from "@/lib/api/products";
import { useClickOutside } from "@/hooks/useClickOutside";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

interface HeaderSearchProps {
  className?: string;
  onNavigate?: () => void;
  /** Top-level categories supplied by the header's single category request. */
  categories?: CategoryWithChildren[];
}

function productHref(product: BackendProduct): string {
  const params = product.manufacturer ? `?manufacturerId=${encodeURIComponent(product.manufacturer.id)}` : "";
  return `/products/${encodeURIComponent(product.mpn)}${params}`;
}

function looksLikePartNumber(value: string): boolean {
  // A known exact result always wins. This fallback preserves the existing
  // direct-MPN path for a fast Enter before autocomplete resolves, while
  // ordinary keyword searches continue to the products results page.
  return /^(?=.*\d)[A-Z0-9][A-Z0-9._/-]*$/i.test(value);
}

export default function HeaderSearch({ className, onNavigate, categories = [] }: HeaderSearchProps) {
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
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

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
      listProducts({ q: term, categoryId: selectedCategoryId || undefined, limit: MAX_RESULTS })
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
  }, [query, retryToken, selectedCategoryId]);

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
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) goToProduct(results[activeIndex]);
      else submitSearch();
      return;
    }
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  }

  function submitSearch() {
    if (activeIndex >= 0 && results[activeIndex]) {
      goToProduct(results[activeIndex]);
      return;
    }
    const term = query.trim();
    if (!term) return;
    const exact = results.find((product) => product.mpn.toUpperCase() === term.toUpperCase());
    if (exact) {
      goToProduct(exact);
      return;
    }
    setOpen(false);
    onNavigate?.();
    if (looksLikePartNumber(term)) {
      router.push(`/products/${encodeURIComponent(term.toUpperCase())}`);
    } else {
      const categoryParam = selectedCategoryId ? `&categoryId=${encodeURIComponent(selectedCategoryId)}` : "";
      router.push(`/products?q=${encodeURIComponent(term)}${categoryParam}`);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSearch();
  }

  const trimmedQuery = query.trim();
  const showDropdown = open && trimmedQuery.length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <form
        onSubmit={handleSubmit}
        className="flex h-11 items-center overflow-hidden rounded-md border border-[#C9CED6] bg-white shadow-sm focus-within:border-[#1769E0] focus-within:ring-2 focus-within:ring-[#1769E0]/20"
      >
        {loading ? (
          <Loader2 size={18} className="ml-3 text-[#75777e] shrink-0 animate-spin" />
        ) : (
          <Search size={18} className="ml-3 text-[#44474d] shrink-0" />
        )}
        <input
          role="combobox"
          aria-label="Search products by MPN, description, or manufacturer"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="header-search-results"
          aria-activedescendant={activeIndex >= 0 ? `header-search-option-${activeIndex}` : undefined}
          className="min-w-0 flex-1 bg-transparent border-none px-3 outline-none font-body-sm text-[#111c2d] placeholder:text-[#75777e]"
          placeholder="Type to search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="p-2 text-[#667085] hover:text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
        <label className="sr-only" htmlFor="header-search-category">Search category</label>
        <select
          id="header-search-category"
          aria-label="Search category"
          value={selectedCategoryId}
          onChange={(event) => setSelectedCategoryId(event.target.value)}
          className="h-full max-w-[10.5rem] border-l border-[#D0D5DD] bg-white px-3 font-body-sm text-[#44474d] outline-none focus:bg-[#F8FAFC]"
        >
          <option value="">All Categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button type="submit" aria-label="Search" className="h-full shrink-0 bg-[#1769E0] px-3 font-label-md text-white hover:bg-[#1257B8] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
          <span className="hidden lg:inline">Search</span>
          <Search size={18} className="lg:hidden" aria-hidden="true" />
        </button>
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
