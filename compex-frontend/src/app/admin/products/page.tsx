"use client";
import { useState, useMemo } from "react";
import { products, manufacturers } from "@/data/mock/products";
import { Search, Plus, Package } from "lucide-react";

const availabilityBadge: Record<string, string> = {
  available: "bg-[#12B76A]/10 text-[#12B76A]",
  limited: "bg-[#F79009]/10 text-[#F79009]",
  on_request: "bg-[#44474d]/10 text-[#44474d]",
};

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];

  const filtered = useMemo(() =>
    products.filter((p) => {
      const q = search.toLowerCase();
      const matchQ = !q || p.mpn.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const matchC = catFilter === "All" || p.category === catFilter;
      return matchQ && matchC;
    }), [search, catFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Product Catalog</h1>
          <p className="font-body-md text-[#44474d]">Manage electronic component listings and availability.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90">
          <Plus size={15} /> Add Product
        </button>
      </div>

      <div className="bg-[#f0f3ff] rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search MPN or description..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-3 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                {["MPN", "Manufacturer", "Category", "Package", "MOQ", "Lead Time", "Availability", "RoHS", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((p) => {
                const mfr = manufacturers.find((m) => m.id === p.manufacturerId);
                return (
                  <tr key={p.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#f0f3ff] rounded flex items-center justify-center shrink-0">
                          <Package size={14} className="text-[#0B1F3A]/40" />
                        </div>
                        <div>
                          <p className="font-mono-label text-[#0B1F3A] font-medium text-sm">{p.mpn}</p>
                          <p className="font-body-sm text-[#44474d] text-xs truncate max-w-[200px]">{p.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{mfr?.name}</td>
                    <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{p.category}</td>
                    <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{p.package}</td>
                    <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{p.moq}</td>
                    <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{p.leadTimeDays}d</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-xs capitalize ${availabilityBadge[p.availability]}`}>
                        {p.availability.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-label-sm text-xs ${p.rohs ? "text-[#12B76A]" : "text-[#F04438]"}`}>{p.rohs ? "✓" : "✗"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="font-label-sm text-[#1769E0] hover:underline text-xs">Edit</button>
                        <button className="font-label-sm text-[#F04438] hover:underline text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}