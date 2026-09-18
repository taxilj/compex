"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { listManufacturers, type ManufacturerListItem } from "@/lib/api/manufacturers";

const PAGE_SIZE = 100; // matches the backend's per-page cap; pages are fetched in a loop below until every manufacturer is loaded, never a fixed top-N truncation

// # first (numeric-leading names), then A-Z -- matches the DigiKey/Mouser
// manufacturer-directory convention this page is modeled on.
const ALPHABET = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

function groupKey(name: string): string {
  const first = name[0]?.toUpperCase() ?? "#";
  return /[A-Z]/.test(first) ? first : "#";
}

export default function ManufacturersGrid() {
  const [manufacturers, setManufacturers] = useState<ManufacturerListItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Load every manufacturer, not a single capped page -- the owner
    // explicitly flagged a truncated/top-N manufacturer list as a defect.
    async function loadAll() {
      const all: ManufacturerListItem[] = [];
      let page = 1;
      for (;;) {
        const res = await listManufacturers({ page, limit: PAGE_SIZE });
        all.push(...res.data);
        if (all.length >= res.total || res.data.length === 0) break;
        page += 1;
      }
      return all;
    }

    loadAll()
      .then((all) => { if (!cancelled) setManufacturers(all); })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load manufacturers:", err);
        setLoadError(true);
      });

    return () => { cancelled = true; };
  }, [retryToken]);

  const filtered = useMemo(() => {
    if (!manufacturers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return manufacturers;
    return manufacturers.filter((m) => m.name.toLowerCase().includes(q));
  }, [manufacturers, query]);

  // Letter -> manufacturers (sorted), for the DigiKey/Mouser-style indexed
  // list -- dense text links grouped under a jump-to heading, not cards.
  const grouped = useMemo(() => {
    const map = new Map<string, ManufacturerListItem[]>();
    for (const m of filtered) {
      const key = groupKey(m.name);
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [filtered]);

  const availableLetters = useMemo(() => new Set(grouped.keys()), [grouped]);

  if (loadError) {
    return (
      <div className="text-center py-16 border border-dashed border-[#F04438]/40 rounded-xl">
        <p className="font-headline-sm text-[#0B1F3A] mb-2" role="alert">Couldn&apos;t load manufacturers</p>
        <p className="font-body-sm text-[#44474d] mb-6 max-w-md mx-auto">
          We couldn&apos;t reach the manufacturer catalogue right now. This is not confirmed as an empty list.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            setManufacturers(null);
            setRetryToken((t) => t + 1);
          }}
          className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (manufacturers === null) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading manufacturers">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[#f0f3ff] animate-pulse" />
        ))}
      </div>
    );
  }

  // Real catalogue data only -- no invented manufacturers, logos, or counts.
  if (manufacturers.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-[#E4E7EC] rounded-xl">
        <p className="font-headline-sm text-[#0B1F3A] mb-2">No manufacturers in the catalogue yet</p>
        <p className="font-body-sm text-[#44474d] mb-6 max-w-md mx-auto">
          Search an exact MPN to check live availability across our sourcing network, or submit your requirement directly.
        </p>
        <Link href="/products" className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors">
          Search a Component
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#75777e]" />
          <input
            aria-label="Search manufacturers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manufacturers..."
            className="w-full pl-9 pr-3 py-2.5 border border-[#E4E7EC] rounded font-body-sm text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#1769E0] focus:border-[#1769E0]"
          />
        </div>
        <p className="font-mono-label text-[#75777e] text-xs uppercase tracking-wider">
          {filtered.length} manufacturer{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* A-Z jump nav, DigiKey/Mouser-style: click a letter to scroll straight
          to its section instead of filtering the list down to one letter. */}
      <div className="flex flex-wrap gap-1 mb-8 sticky top-16 sm:top-[6.25rem] lg:top-[9.25rem] z-10 bg-white/95 backdrop-blur-sm py-2 -mx-1 px-1" role="navigation" aria-label="Jump to manufacturers starting with">
        {ALPHABET.map((l) => {
          const has = availableLetters.has(l);
          return has ? (
            <a
              key={l}
              href={`#letter-${l}`}
              className="min-w-8 h-8 px-2 rounded text-xs font-label-sm flex items-center justify-center border border-[#E4E7EC] text-[#44474d] hover:border-[#1769E0] hover:text-[#1769E0] transition-colors"
            >
              {l}
            </a>
          ) : (
            <span
              key={l}
              aria-hidden="true"
              className="min-w-8 h-8 px-2 rounded text-xs font-label-sm flex items-center justify-center text-[#C9CED6]"
            >
              {l}
            </span>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="font-body-md text-[#44474d] py-12 text-center">No manufacturers match your search.</p>
      ) : (
        <div className="space-y-10">
          {ALPHABET.filter((l) => grouped.has(l)).map((l) => (
            <section key={l} id={`letter-${l}`} className="scroll-mt-24">
              <h2 className="font-headline-sm text-[#0B1F3A] border-b border-[#E4E7EC] pb-2 mb-3">{l}</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
                {grouped.get(l)!.map((mfr) => (
                  <li key={mfr.id}>
                    <Link
                      href={`/manufacturers/${mfr.slug}`}
                      className="flex items-baseline justify-between gap-2 py-1 font-body-sm text-[#111c2d] hover:text-[#1769E0] hover:underline"
                    >
                      <span className="truncate">{mfr.name}</span>
                      <span className="font-mono-label text-[#75777e] text-xs shrink-0">{mfr._count.products}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
