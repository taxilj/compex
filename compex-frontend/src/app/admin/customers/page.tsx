"use client";
import { useState, useMemo } from "react";
import { customers } from "@/data/mock/customers";
import { Search, Plus, ArrowUpRight } from "lucide-react";

export default function AdminCustomersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [salespersonFilter, setSalespersonFilter] = useState("all");

  const filtered = useMemo(() =>
    customers.filter((c) => {
      const q = search.toLowerCase();
      const matchQ = !q || c.company.toLowerCase().includes(q) || c.gstin.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q);
      const matchS = statusFilter === "all" || c.status === statusFilter;
      const matchSp = salespersonFilter === "all" || c.salesperson === salespersonFilter;
      return matchQ && matchS && matchSp;
    }), [search, statusFilter, salespersonFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Customer Management</h1>
          <p className="font-body-md text-[#44474d]">Manage clients, view interactions, and track sales performance.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#e8eeff] rounded-lg p-5 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block font-label-sm text-[#44474d] mb-1.5 uppercase tracking-wider text-xs">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company or GSTIN..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
          </div>
        </div>
        <div className="w-40">
          <label className="block font-label-sm text-[#44474d] mb-1.5 uppercase tracking-wider text-xs">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full py-2.5 px-3 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]">
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="w-40">
          <label className="block font-label-sm text-[#44474d] mb-1.5 uppercase tracking-wider text-xs">Salesperson</label>
          <select value={salespersonFilter} onChange={(e) => setSalespersonFilter(e.target.value)} className="w-full py-2.5 px-3 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]">
            <option value="all">All Sales</option>
            {["Arjun", "Sarah", "Mike"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E4E7EC] flex items-center justify-between">
          <span className="font-label-sm text-[#44474d] text-xs uppercase tracking-wider">{filtered.length} customers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                {["Company", "Primary Contact", "GSTIN", "RFQs", "Orders", "Revenue", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#e8eeff] text-[#0B1F3A] flex items-center justify-center font-bold text-sm shrink-0">{c.initials}</div>
                      <div>
                        <p className="font-label-md text-[#111c2d] text-sm">{c.company}</p>
                        <p className="font-body-sm text-[#44474d] text-xs">{c.city} · {c.region}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-body-sm text-[#111c2d] text-sm">{c.contact}</p>
                    <p className="font-body-sm text-[#44474d] text-xs">{c.email}</p>
                  </td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-xs">{c.gstin}</td>
                  <td className="px-5 py-4 text-right font-mono-label text-[#111c2d] text-sm">{c.rfqCount}</td>
                  <td className="px-5 py-4 text-right font-mono-label text-[#111c2d] text-sm">{c.orderCount}</td>
                  <td className="px-5 py-4 text-right font-mono-label text-[#111c2d] text-sm">₹{c.revenueL.toFixed(1)}L</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full font-label-sm text-xs ${c.status === "active" ? "bg-[#12B76A]/10 text-[#12B76A]" : "bg-[#44474d]/10 text-[#44474d]"}`}>
                      {c.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-label-sm text-[#1769E0] hover:underline text-xs">
                      View <ArrowUpRight size={12} />
                    </button>
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