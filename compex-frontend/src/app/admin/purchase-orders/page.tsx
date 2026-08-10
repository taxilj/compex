"use client";
import { useState, useMemo } from "react";
import { Search, Download, Plus } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Status } from "@/types";

const mockPOs = [
  { id: "PO-2024-001", vendor: "STMicroelectronics", items: 3, value: "₹12.4L", currency: "EUR", payment: "paid", status: "delivered", eta: "2026-08-05", created: "2026-07-10" },
  { id: "PO-2024-002", vendor: "Texas Instruments", items: 2, value: "₹8.9L", currency: "USD", payment: "partial", status: "shipped", eta: "2026-08-15", created: "2026-07-18" },
  { id: "PO-2024-003", vendor: "Mouser Electronics", items: 5, value: "₹4.2L", currency: "USD", payment: "pending", status: "processing", eta: "2026-08-22", created: "2026-08-01" },
  { id: "PO-2024-004", vendor: "NXP Semiconductors", items: 4, value: "₹18.5L", currency: "EUR", payment: "pending", status: "procurement", eta: "2026-09-01", created: "2026-08-05" },
  { id: "PO-2024-005", vendor: "Arrow Electronics India", items: 7, value: "₹6.7L", currency: "INR", payment: "paid", status: "delivered", eta: "2026-07-28", created: "2026-07-12" },
];

const paymentBadge: Record<string, string> = {
  paid: "bg-[#12B76A]/10 text-[#12B76A]",
  partial: "bg-[#F79009]/10 text-[#F79009]",
  pending: "bg-[#F04438]/10 text-[#F04438]",
};

const STATUS_TABS = ["All", "processing", "procurement", "shipped", "delivered"];

export default function AdminPurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");

  const filtered = useMemo(() =>
    mockPOs.filter((p) => {
      const q = search.toLowerCase();
      const matchQ = !q || p.id.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q);
      const matchT = tab === "All" || p.status === tab;
      return matchQ && matchT;
    }), [search, tab]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Purchase Orders</h1>
          <p className="font-body-md text-[#44474d]">Track vendor purchase orders and import progress.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 border border-[#E4E7EC] bg-white px-4 py-2 rounded font-label-md text-sm text-[#111c2d] hover:bg-[#f0f3ff]">
            <Download size={15} /> Export
          </button>
          <button className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md text-sm hover:bg-[#0B1F3A]/90">
            <Plus size={15} /> New PO
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO # or vendor..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
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
                {["PO #", "Vendor", "Items", "Value", "Currency", "Payment", "Status", "ETA", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((po) => (
                <tr key={po.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                  <td className="px-5 py-4 font-mono-label text-[#0B1F3A] font-medium text-sm">{po.id}</td>
                  <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{po.vendor}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{po.items}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] font-semibold text-sm">{po.value}</td>
                  <td className="px-5 py-4"><span className="font-mono-label text-xs bg-[#f0f3ff] text-[#0B1F3A] px-2 py-0.5 rounded">{po.currency}</span></td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-xs capitalize ${paymentBadge[po.payment]}`}>{po.payment}</span>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={po.status as Status} /></td>
                  <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{po.eta}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="font-label-sm text-[#1769E0] hover:underline text-xs">View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center font-body-md text-[#44474d]">No purchase orders found</div>}
      </div>
    </div>
  );
}