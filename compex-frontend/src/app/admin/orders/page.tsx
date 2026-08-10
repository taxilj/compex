"use client";
import { useState, useMemo } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Search, Download } from "lucide-react";

const mockSalesOrders = [
  { id: "SO-2024-001", rfq: "RQ-8921", customer: "Bharat Forge", items: 5, value: "₹8.9L", payment: "paid", status: "delivered", date: "2026-07-15" },
  { id: "SO-2024-002", rfq: "RQ-8919", customer: "ABB India Ltd", items: 8, value: "₹34.2L", payment: "partial", status: "shipped", date: "2026-07-20" },
  { id: "SO-2024-003", rfq: "RQ-8917", customer: "TechCorp Industries", items: 1, value: "₹0.9L", payment: "paid", status: "delivered", date: "2026-07-25" },
  { id: "SO-2024-004", rfq: "RQ-8916", customer: "L&T Heavy Eng", items: 3, value: "₹12.4L", payment: "pending", status: "processing", date: "2026-08-01" },
  { id: "SO-2024-005", rfq: "RQ-8914", customer: "Tata Motors", items: 6, value: "₹22.1L", payment: "pending", status: "processing", date: "2026-08-05" },
];

const paymentBadge: Record<string, string> = {
  paid: "bg-[#12B76A]/10 text-[#12B76A]",
  partial: "bg-[#F79009]/10 text-[#F79009]",
  pending: "bg-[#F04438]/10 text-[#F04438]",
};

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() =>
    mockSalesOrders.filter((o) => {
      const q = search.toLowerCase();
      return !q || o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.rfq.toLowerCase().includes(q);
    }), [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Sales Orders</h1>
          <p className="font-body-md text-[#44474d]">Track confirmed orders from quotation to delivery.</p>
        </div>
        <button className="flex items-center gap-2 border border-[#E4E7EC] bg-white text-[#111c2d] px-4 py-2 rounded font-label-md hover:bg-[#f0f3ff] transition-colors">
          <Download size={15} /> Export
        </button>
      </div>

      <div className="bg-[#f0f3ff] rounded-lg p-4 flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, RFQ or customer..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
        </div>
        <select className="px-3 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none">
          <option>All Statuses</option>
          <option>Processing</option>
          <option>Shipped</option>
          <option>Delivered</option>
        </select>
        <select className="px-3 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none">
          <option>All Payments</option>
          <option>Paid</option>
          <option>Partial</option>
          <option>Pending</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                {["Order #", "RFQ", "Customer", "Items", "Order Value", "Payment", "Status", "Date", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-[#f0f3ff]/40 transition-colors cursor-pointer">
                  <td className="px-5 py-4 font-mono-label text-[#0B1F3A] font-medium text-sm">{o.id}</td>
                  <td className="px-5 py-4 font-mono-label text-[#1769E0] text-sm hover:underline cursor-pointer">{o.rfq}</td>
                  <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{o.customer}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{o.items}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm font-medium">{o.value}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-xs capitalize ${paymentBadge[o.payment]}`}>{o.payment}</span>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-4 font-mono-label text-[#44474d] text-xs">{o.date}</td>
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