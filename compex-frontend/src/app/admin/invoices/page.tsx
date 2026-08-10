"use client";
import { useState, useMemo } from "react";
import { invoices } from "@/data/mock/invoices";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Search, Download, Plus } from "lucide-react";

const TAB_FILTERS = ["All", "paid", "pending", "overdue"];

export default function AdminInvoicesPage() {
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() =>
    invoices.filter((inv) => {
      const q = search.toLowerCase();
      const matchQ = !q || inv.number.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q);
      const matchT = tab === "All" || inv.status === tab;
      return matchQ && matchT;
    }), [search, tab]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Invoices</h1>
          <p className="font-body-md text-[#44474d]">Manage all customer invoices and payment status.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 border border-[#E4E7EC] bg-white text-[#111c2d] px-4 py-2 rounded font-label-md hover:bg-[#f0f3ff]">
            <Download size={15} /> Export
          </button>
          <button className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90">
            <Plus size={15} /> New Invoice
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#f0f3ff] p-1 rounded-lg w-fit">
        {TAB_FILTERS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded font-label-md text-sm capitalize transition-colors ${tab === t ? "bg-white text-[#111c2d] shadow-sm" : "text-[#44474d] hover:text-[#111c2d]"}`}>
            {t === "All" ? "All" : t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E4E7EC] flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice or customer..." className="pl-8 pr-4 py-1.5 border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#1769E0] w-64" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                {["Invoice #", "Customer", "Order", "Amount", "GST", "Total", "Due Date", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#f0f3ff]/40 transition-colors cursor-pointer">
                  <td className="px-5 py-4 font-mono-label text-[#1769E0] font-medium text-sm hover:underline">{inv.number}</td>
                  <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{inv.customerName}</td>
                  <td className="px-5 py-4 font-mono-label text-[#44474d] text-sm">{inv.orderNumber}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">₹{(inv.subtotal / 100).toFixed(2)}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">₹{(inv.gstAmount / 100).toFixed(2)}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] font-medium text-sm">₹{(inv.grandTotal / 100).toFixed(2)}</td>
                  <td className="px-5 py-4 font-mono-label text-[#44474d] text-xs">{inv.dueDate}</td>
                  <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                  <td className="px-5 py-4">
                    <button className="font-label-sm text-[#1769E0] hover:underline text-xs">View</button>
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