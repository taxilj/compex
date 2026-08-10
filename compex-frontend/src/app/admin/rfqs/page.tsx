"use client";
import { useState, useMemo } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Search, Download, Plus, ChevronLeft, ChevronRight } from "lucide-react";

const STATUSES = ["All", "sourcing", "under_review", "quote_ready", "closed_won", "closed_lost"];

const mockRFQs = [
    { id: "RQ-8924", customer: "Tata Motors", items: 3, value: "₹4.2L", assigned: "Arjun R.", status: "sourcing", date: "2026-08-09", priority: "high" },
    { id: "RQ-8923", customer: "L&T Heavy Eng", items: 7, value: "₹18.5L", assigned: "Sarah K.", status: "under_review", date: "2026-08-07", priority: "high" },
    { id: "RQ-8922", customer: "Mahindra Electric", items: 2, value: "₹1.1L", assigned: "Mike J.", status: "quote_ready", date: "2026-08-06", priority: "medium" },
    { id: "RQ-8921", customer: "Bharat Forge", items: 5, value: "₹8.9L", assigned: "Arjun R.", status: "closed_won", date: "2026-08-04", priority: "low" },
    { id: "RQ-8920", customer: "Godrej & Boyce", items: 4, value: "₹2.4L", assigned: "Sarah K.", status: "sourcing", date: "2026-08-03", priority: "medium" },
    { id: "RQ-8919", customer: "ABB India Ltd", items: 8, value: "₹34.2L", assigned: "Arjun R.", status: "quote_ready", date: "2026-08-01", priority: "high" },
    { id: "RQ-8918", customer: "ISRO Satellite", items: 12, value: "₹7.8L", assigned: "Mike J.", status: "under_review", date: "2026-07-30", priority: "high" },
    { id: "RQ-8917", customer: "TechCorp Industries", items: 1, value: "₹0.9L", assigned: "Sarah K.", status: "closed_won", date: "2026-07-28", priority: "low" },
];

export default function AdminRFQsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() =>
    mockRFQs.filter((r) => {
      const q = search.toLowerCase();
      const matchQ = !q || r.id.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q);
      const matchS = statusFilter === "All" || r.status === statusFilter;
      return matchQ && matchS;
    }), [search, statusFilter]);

  const priorityColor = { high: "text-[#F04438]", medium: "text-[#F79009]", low: "text-[#12B76A]" } as Record<string, string>;

  return (
    <div className="space-y-0 h-full flex flex-col">
      {/* Sticky header */}
      <div className="bg-white border-b border-[#E4E7EC] px-0 py-5 mb-0 flex items-center justify-between -mx-8 -mt-8 px-8 sticky top-0 z-10">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Requests for Quotation</h1>
          <p className="font-body-sm text-[#44474d] mt-0.5">Manage and track customer quotes across the supply chain.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-9 px-4 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#f0f3ff] flex items-center gap-2 font-label-md text-sm text-[#111c2d]">
            <Download size={15} /> Export
          </button>
          <button className="h-9 px-4 rounded-lg bg-[#e8eeff] hover:bg-[#e8eeff]/80 flex items-center gap-2 font-label-md text-sm text-[#0B1F3A]">
            <Plus size={15} /> New RFQ
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-[#f0f3ff] border-b border-[#E4E7EC] px-8 py-3 -mx-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search RFQ or customer..." className="pl-9 pr-4 py-1.5 rounded-lg border border-[#E4E7EC] bg-white text-sm focus:outline-none focus:border-[#1769E0] w-56" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-[#E4E7EC] bg-white text-sm focus:outline-none focus:border-[#1769E0]">
            {STATUSES.map((s) => <option key={s}>{s === "All" ? "Status (All)" : s.replace(/_/g, " ")}</option>)}
          </select>
          <select className="px-3 py-1.5 rounded-lg border border-[#E4E7EC] bg-white text-sm focus:outline-none">
            <option>Assigned To</option>
            <option>Arjun R.</option>
            <option>Sarah K.</option>
            <option>Mike J.</option>
          </select>
          <select className="px-3 py-1.5 rounded-lg border border-[#E4E7EC] bg-white text-sm focus:outline-none">
            <option>Priority</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#44474d]">
          <span>Showing 1–{filtered.length} of {filtered.length}</span>
          <button className="w-7 h-7 border border-[#E4E7EC] rounded bg-white flex items-center justify-center hover:bg-[#e8eeff]"><ChevronLeft size={14} /></button>
          <button className="w-7 h-7 border border-[#E4E7EC] rounded bg-white flex items-center justify-center hover:bg-[#e8eeff]"><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white border border-[#E4E7EC] rounded-xl overflow-hidden mt-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
              <tr>
                {["RFQ #", "Customer", "Items", "Value", "Assigned", "Status", "Priority", "Date", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-label-md text-[#44474d] text-sm font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[#f0f3ff]/40 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-mono-label text-[#1769E0] font-medium hover:underline">{r.id}</td>
                  <td className="px-4 py-3 font-body-sm text-[#111c2d] text-sm">{r.customer}</td>
                  <td className="px-4 py-3 font-mono-label text-[#111c2d] text-sm">{r.items}</td>
                  <td className="px-4 py-3 font-mono-label text-[#111c2d] text-sm">{r.value}</td>
                  <td className="px-4 py-3 font-body-sm text-[#111c2d] text-sm">{r.assigned}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <span className={`font-label-sm capitalize text-xs ${priorityColor[r.priority]}`}>{r.priority}</span>
                  </td>
                  <td className="px-4 py-3 font-mono-label text-[#44474d] text-xs">{r.date}</td>
                  <td className="px-4 py-3">
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