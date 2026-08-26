"use client";

import { useEffect, useMemo, useState } from "react";
import { Factory, Loader2, Search } from "lucide-react";
import { listManufacturers, type Manufacturer } from "@/lib/api/admin";

export default function AdminManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listManufacturers()
      .then((result) => { setManufacturers(result.data); setTotal(result.total); })
      .catch(() => setError("Failed to load manufacturers."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? manufacturers.filter((manufacturer) => manufacturer.name.toLowerCase().includes(term) || manufacturer.slug.toLowerCase().includes(term)) : manufacturers;
  }, [manufacturers, search]);

  return (
    <div className="space-y-6">
      <div><h1 className="font-headline-lg text-[#111c2d]">Manufacturers</h1><p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${total} live manufacturer records`}</p></div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search manufacturers" placeholder="Search name or slug…" className="w-full rounded border border-[#E4E7EC] bg-white py-2.5 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></div>
      {error && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-sm">
        {loading ? <div className="flex items-center justify-center py-16 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={20} /> Loading manufacturers…</div> :
          filtered.length === 0 ? <p className="py-16 text-center text-[#667085]">No manufacturers found.</p> :
          <div className="grid grid-cols-1 divide-y divide-[#E4E7EC] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">{filtered.map((manufacturer) => <article key={manufacturer.id} className="p-5"><div className="mb-3 flex items-center gap-3"><span className="rounded-lg bg-[#e8eeff] p-2 text-[#1769E0]"><Factory size={18} /></span><div><h2 className="font-label-md text-[#111c2d]">{manufacturer.name}</h2><p className="font-mono text-xs text-[#667085]">{manufacturer.slug}</p></div></div>{manufacturer.website ? <a href={manufacturer.website} target="_blank" rel="noreferrer" className="font-body-sm text-[#1769E0] hover:underline">Open website</a> : <p className="font-body-sm text-[#667085]">No website recorded</p>}</article>)}</div>}
      </div>
    </div>
  );
}
