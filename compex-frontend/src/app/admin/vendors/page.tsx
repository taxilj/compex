"use client";
import { useState, useMemo } from "react";
import { vendors } from "@/data/mock/vendors";
import { Search, Plus, Star } from "lucide-react";

function RatingStars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} size={12} className={i <= n ? "fill-[#F79009] text-[#F79009]" : "text-[#E4E7EC]"} />
      ))}
    </div>
  );
}

const statusColors: Record<string, string> = {
  active: "bg-[#12B76A]/10 text-[#12B76A]",
  inactive: "bg-[#44474d]/10 text-[#44474d]",
  pending: "bg-[#F79009]/10 text-[#F79009]",
};

export default function AdminVendorsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() =>
    vendors.filter((v) => {
      const q = search.toLowerCase();
      const matchQ = !q || v.company.toLowerCase().includes(q) || v.country.toLowerCase().includes(q);
      const matchS = statusFilter === "all" || v.status === statusFilter;
      return matchQ && matchS;
    }), [search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Vendor Management</h1>
          <p className="font-body-md text-[#44474d]">Manage supplier relationships and track procurement performance.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors">
          <Plus size={16} /> Add Vendor
        </button>
      </div>

      <div className="bg-[#e8eeff] rounded-lg p-5 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block font-label-sm text-[#44474d] mb-1.5 uppercase tracking-wider text-xs">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor or country..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
          </div>
        </div>
        <div className="w-40">
          <label className="block font-label-sm text-[#44474d] mb-1.5 uppercase tracking-wider text-xs">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full py-2.5 px-3 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                {["Vendor", "Contact", "Country", "Categories", "Rating", "Orders", "Total Value", "Lead Time", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-[#f0f3ff]/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-[#0B1F3A]/10 flex items-center justify-center font-bold text-xs text-[#0B1F3A] shrink-0">{v.initials}</div>
                      <span className="font-label-md text-[#111c2d] text-sm">{v.company}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-body-sm text-[#111c2d] text-sm">{v.contact}</p>
                    <p className="font-body-sm text-[#44474d] text-xs">{v.email}</p>
                  </td>
                  <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{v.country}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {v.categories.slice(0,2).map((c) => <span key={c} className="px-1.5 py-0.5 bg-[#e8eeff] text-[#0B1F3A] rounded text-[10px] font-medium">{c}</span>)}
                      {v.categories.length > 2 && <span className="text-[10px] text-[#44474d]">+{v.categories.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4"><RatingStars n={v.rating} /></td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm text-right">{v.orderCount}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm text-right">₹{v.totalValueL.toFixed(1)}L</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{v.leadTimeDays}d</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full font-label-sm text-xs capitalize ${statusColors[v.status]}`}>{v.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}