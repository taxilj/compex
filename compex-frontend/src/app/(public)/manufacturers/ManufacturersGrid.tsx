"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { listManufacturers, type ManufacturerListItem } from "@/lib/api/manufacturers";
import { listProducts } from "@/lib/api/products";

export default function ManufacturersGrid() {
  const [manufacturers, setManufacturers] = useState<ManufacturerListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  // One real product image per manufacturer, reused as a card thumbnail when no
  // logoUrl is on file — never a generated/invented logo. A single page-wide
  // fetch (not one call per card) since the catalogue is small enough to fit
  // in one page.
  const [sampleImages, setSampleImages] = useState<Record<string, string>>({});

  useEffect(() => {
    listManufacturers({ limit: 100 })
      .then((r) => setManufacturers(r.data))
      .catch(() => setManufacturers([]));
  }, []);

  useEffect(() => {
    listProducts({ limit: 100 })
      .then((r) => {
        const map: Record<string, string> = {};
        for (const p of r.data) {
          const mfrId = p.manufacturer?.id;
          const image = p.images[0];
          if (mfrId && image && !map[mfrId]) map[mfrId] = image;
        }
        setSampleImages(map);
      })
      .catch(() => {});
  }, []);

  const letters = useMemo(() => {
    if (!manufacturers) return [];
    return Array.from(new Set(manufacturers.map((m) => m.name[0]?.toUpperCase()).filter(Boolean))).sort();
  }, [manufacturers]);

  const filtered = useMemo(() => {
    if (!manufacturers) return [];
    const q = query.trim().toLowerCase();
    return manufacturers.filter((m) => {
      const matchesQuery = q === "" || m.name.toLowerCase().includes(q);
      const matchesLetter = !letter || m.name[0]?.toUpperCase() === letter;
      return matchesQuery && matchesLetter;
    });
  }, [manufacturers, query, letter]);

  if (manufacturers === null) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading manufacturers">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[#f0f3ff] animate-pulse" />
        ))}
      </div>
    );
  }

  // Real catalogue data only — no invented manufacturers, logos, or counts.
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
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter manufacturers alphabetically">
          <button
            type="button"
            onClick={() => setLetter(null)}
            className={`min-w-8 h-8 px-2 rounded text-xs font-label-sm transition-colors ${!letter ? "bg-[#0B1F3A] text-white" : "border border-[#E4E7EC] text-[#44474d] hover:border-[#1769E0]"}`}
          >
            All
          </button>
          {letters.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLetter(l === letter ? null : l)}
              className={`w-8 h-8 rounded text-xs font-label-sm transition-colors ${letter === l ? "bg-[#0B1F3A] text-white" : "border border-[#E4E7EC] text-[#44474d] hover:border-[#1769E0]"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="font-body-md text-[#44474d] py-12 text-center">No manufacturers match your search.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((mfr) => {
            const image = mfr.logoUrl || sampleImages[mfr.id];
            return (
              <Link
                key={mfr.id}
                href={`/manufacturers/${mfr.slug}`}
                className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:border-[#1769E0] hover:shadow-md transition-all block"
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 rounded-lg bg-[#f0f3ff] border border-[#E4E7EC] flex items-center justify-center shrink-0 overflow-hidden">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <span className="font-bold text-[#0B1F3A] text-sm">{mfr.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <h2 className="font-headline-sm text-[#0B1F3A]">{mfr.name}</h2>
                </div>
                <p className="font-mono-label text-[#1769E0] text-xs uppercase tracking-wider">
                  {mfr._count.products} product{mfr._count.products !== 1 ? "s" : ""} in catalogue
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
