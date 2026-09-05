"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listManufacturers, type ManufacturerListItem } from "@/lib/api/manufacturers";

interface CuratedManufacturer {
  name: string;
  abbr: string;
  categories: string[];
}

// The catalog starts empty until products/manufacturers are created or
// imported (Phase 7/8). Show real catalog manufacturers once any exist;
// until then, fall back to this curated list so the page still communicates
// sourcing breadth instead of rendering an empty grid.
export default function ManufacturersGrid({ fallback }: { fallback: CuratedManufacturer[] }) {
  const [manufacturers, setManufacturers] = useState<ManufacturerListItem[] | null>(null);

  useEffect(() => {
    listManufacturers({ limit: 100 })
      .then((r) => setManufacturers(r.data))
      .catch(() => setManufacturers([]));
  }, []);

  if (manufacturers && manufacturers.length > 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {manufacturers.map((mfr) => (
          <Link
            key={mfr.id}
            href={`/manufacturers/${mfr.slug}`}
            className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:border-[#1769E0] hover:shadow-md transition-all block"
          >
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center shrink-0 overflow-hidden">
                {mfr.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mfr.logoUrl} alt={mfr.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="font-bold text-[#0B1F3A] text-sm">{mfr.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <h2 className="font-headline-sm text-[#0B1F3A]">{mfr.name}</h2>
            </div>
            <p className="font-body-sm text-[#44474d]">{mfr._count.products} product{mfr._count.products !== 1 ? "s" : ""} in catalogue</p>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {fallback.map((mfr) => (
        <div key={mfr.name} className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:border-[#1769E0] hover:shadow-md transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center shrink-0">
              <span className="font-bold text-[#0B1F3A] text-sm">{mfr.abbr}</span>
            </div>
            <h2 className="font-headline-sm text-[#0B1F3A]">{mfr.name}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {mfr.categories.map((cat) => (
              <span key={cat} className="bg-[#f0f3ff] text-[#1769E0] text-xs font-medium px-3 py-1 rounded-full">
                {cat}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
