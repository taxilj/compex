"use client";
import { useState, useEffect, useMemo } from "react";
import { Search, Loader2 } from "lucide-react";
import { listVendors, type Vendor } from "@/lib/api/admin";

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listVendors()
      .then((res) => { setVendors(res.data); setTotal(res.total); })
      .catch(() => setError("Failed to load vendors."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return vendors;
    const q = search.toLowerCase();
    return vendors.filter((v) =>
      v.name.toLowerCase().includes(q) ||
      v.contactEmail.toLowerCase().includes(q)
    );
  }, [vendors, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Vendor Management</h1>
          <p className="font-body-md text-[#44474d]">
            {loading ? "Loading…" : `${total} vendors`}
          </p>
        </div>
      </div>

      <div className="bg-[#e8eeff] rounded-lg p-5">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor or email..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-[#44474d]">
          <Loader2 size={22} className="animate-spin mr-2" /> Loading vendors…
        </div>
      )}

      {error && <p className="text-[#F04438] font-body-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                  {["Vendor", "Email", "Phone", "Address", "Added"].map((h) => (
                    <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center font-body-md text-[#44474d]">No vendors found.</td>
                  </tr>
                ) : filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-[#f0f3ff]/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-[#0B1F3A]/10 flex items-center justify-center font-bold text-xs text-[#0B1F3A] shrink-0">
                          {v.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-label-md text-[#111c2d] text-sm">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{v.contactEmail}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{v.contactPhone ?? "—"}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm max-w-[240px] truncate">{v.address ?? "—"}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-xs">{v.createdAt.split("T")[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
