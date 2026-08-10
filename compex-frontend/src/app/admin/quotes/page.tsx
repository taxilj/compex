"use client";
import { useState, useMemo } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Status } from "@/types";
import { Search, Download, Plus } from "lucide-react";

const mockQuotes = [
  { id: "QT-4521", rfq: "RQ-8919", customer: "ABB India Ltd", items: 8, subtotal: "₹28.4L", gst: "₹5.1L", total: "₹33.5L", validUntil: "2026-08-20", status: "pending", created: "2026-08-01" },
  { id: "QT-4520", rfq: "RQ-8921", customer: "Bharat Forge Ltd", items: 5, subtotal: "₹7.2L", gst: "₹1.3L", total: "₹8.5L", validUntil: "2026-08-18", status: "accepted", created: "2026-07-30" },
  { id: "QT-4519", rfq: "RQ-8918", customer: "ISRO Satellite Centre", items: 12, subtotal: "₹6.5L", gst: "₹1.2L", total: "₹7.7L", validUntil: "2026-08-15", status: "pending", created: "2026-07-28" },
  { id: "QT-4518", rfq: "RQ-8917", customer: "TechCorp Industries", items: 1, subtotal: "₹0.75L", gst: "₹0.14L", total: "₹0.89L", validUntil: "2026-08-10", status: "expired", created: "2026-07-25" },
  { id: "QT-4517", rfq: "RQ-8916", customer: "L&T Heavy Engineering", items: 3, subtotal: "₹10.2L", gst: "₹1.8L", total: "₹12.0L", validUntil: "2026-08-22", status: "accepted", created: "2026-07-20" },
  { id: "QT-4516", rfq: "RQ-8915", customer: "Godrej & Boyce", items: 4, subtotal: "₹1.9L", gst: "₹0.3L", total: "₹2.2L", validUntil: "2026-08-05", status: "rejected", created: "2026-07-15" },
];

const STATUS_TABS = ["All", "pending", "accepted", "expired", "rejected"];

export default function AdminQuotesPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");

  const filtered = useMemo(() =>
    mockQuotes.filter((q) => {
      const t = search.toLowerCase();
      const matchQ = !t || q.id.toLowerCase().includes(t) || q.customer.toLowerCase().includes(t) || q.rfq.toLowerCase().includes(t);
      const matchT = tab === "All" || q.status === tab;
      return matchQ && matchT;
    }), [search, tab]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Quotes</h1>
          <p className="font-body-md text-[#44474d]">Manage customer quotations and approvals.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 border border-[#E4E7EC] bg-white px-4 py-2 rounded font-label-md text-sm text-[#111c2d] hover:bg-[#f0f3ff]">
            <Download size={15} /> Export
          </button>
          <button className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md text-sm hover:bg-[#0B1F3A]/90">
            <Plus size={15} /> New Quote
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quote # or customer..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
        </div>
        <div className="flex gap-1 bg-[#f0f3ff] p-1 rounded-lg">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => setTab(s)} className={`px-3 py-1.5 rounded font-label-sm text-xs capitalize transition-colors ${tab === s ? "bg-white text-[#0B1F3A] shadow-sm" : "text-[#44474d] hover:text-[#0B1F3A]"}`}>{s}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                {["Quote #", "RFQ", "Customer", "Items", "Subtotal", "GST", "Total", "Valid Until", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((q) => (
                <tr key={q.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                  <td className="px-5 py-4 font-mono-label text-[#0B1F3A] font-medium text-sm">{q.id}</td>
                  <td className="px-5 py-4 font-mono-label text-[#44474d] text-sm">{q.rfq}</td>
                  <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{q.customer}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{q.items}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{q.subtotal}</td>
                  <td className="px-5 py-4 font-mono-label text-[#44474d] text-sm">{q.gst}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] font-semibold text-sm">{q.total}</td>
                  <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{q.validUntil}</td>
                  <td className="px-5 py-4"><StatusBadge status={q.status as Status} /></td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="font-label-sm text-[#1769E0] hover:underline text-xs">View</button>
                      <button className="font-label-sm text-[#44474d] hover:underline text-xs">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center font-body-md text-[#44474d]">No quotes found</div>
        )}
      </div>
    </div>
  );
}