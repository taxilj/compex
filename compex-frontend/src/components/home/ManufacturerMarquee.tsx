"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listManufacturers, type ManufacturerListItem } from "@/lib/api/manufacturers";

export function ManufacturerMarquee() {
  const [manufacturers, setManufacturers] = useState<ManufacturerListItem[] | null>(null);

  useEffect(() => {
    listManufacturers({ limit: 20 })
      .then((r) => setManufacturers(r.data))
      .catch(() => setManufacturers([]));
  }, []);

  // Real catalogue data only — no invented manufacturer names. Hide the
  // section entirely rather than show a fabricated list when the catalogue
  // is empty.
  if (!manufacturers || manufacturers.length === 0) return null;

  const items = [...manufacturers, ...manufacturers];

  return (
    <section className="py-14 px-4 md:px-8 overflow-hidden bg-white border-b border-[#E4E7EC]">
      <div className="max-w-[1280px] mx-auto mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-[#0B1F3A]">Manufacturers</h2>
          <p className="font-body-sm text-[#44474d] mt-1">Component manufacturers represented in the Compex catalogue.</p>
        </div>
        <Link href="/manufacturers" className="font-label-md text-[#1769E0] hover:underline whitespace-nowrap shrink-0">View all →</Link>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, #ffffff, transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: "linear-gradient(-90deg, #ffffff, transparent)" }} />

        <div className="flex gap-3 animate-marquee">
          {items.map((mfr, i) => (
            <Link
              key={`${mfr.id}-${i}`}
              href={`/manufacturers/${mfr.slug}`}
              className="inline-flex items-center border border-[#E4E7EC] px-5 py-3 shrink-0 hover:border-[#1769E0] transition-colors"
            >
              <span className="font-mono-label text-[#0B1F3A] text-sm whitespace-nowrap">{mfr.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
