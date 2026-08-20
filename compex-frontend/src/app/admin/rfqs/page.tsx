"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { listAdminRfqs, type AdminRfq } from "@/lib/api/admin";
import { Search, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const STATUSES = ["All", "SUBMITTED", "UNDER_REVIEW", "SOURCING", "CANCELLED"] as const;
const PRIORITIES = ["All", "HIGH", "MEDIUM", "LOW"] as const;
const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "text-[#F04438]",
  MEDIUM: "text-[#F79009]",
  LOW: "text-[#12B76A]",
};

export default function AdminRFQsPage() {
  const [rfqs, setRfqs] = useState<AdminRfq[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<typeof STATUSES[number]>("All");
  const [priorityFilter, setPriorityFilter] = useState<typeof PRIORITIES[number]>("All");

  useEffect(() => {
    setLoading(true);
    setError(null);
    listAdminRfqs({
      status: statusFilter !== "All" ? statusFilter : undefined,
      priority: priorityFilter !== "All" ? priorityFilter : undefined,
      limit: 50,
    })
      .then((res) => { setRfqs(res.data); setTotal(res.total); })
      .catch(() => setError("Failed to load RFQs."))
      .finally(() => setLoading(false));
  }, [statusFilter, priorityFilter]);

  const filtered = useMemo(() => {
    if (!search) return rfqs;
    const q = search.toLowerCase();
    return rfqs.filter((r) =>
      r.rfqNumber.toLowerCase().includes(q) ||
      r.customer.company.name.toLowerCase().includes(q) ||
      r.customer.user.email.toLowerCase().includes(q)
    );
  }, [rfqs, search]);

  return (
    <div className="space-y-0 h-full flex flex-col">
      <div className="bg-white border-b border-[#E4E7EC] px-0 py-5 mb-0 flex items-center justify-between -mx-8 -mt-8 px-8 sticky top-0 z-10">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Requests for Quotation</h1>
          <p className="font-body-sm text-[#44474d] mt-0.5">
            {loading ? "Loading…" : `${total} total RFQs`}
          </p>
        </div>
        <button className="h-9 px-4 rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#f0f3ff] flex items-center gap-2 font-label-md text-sm text-[#111c2d]">
          <Download size={15} /> Export
        </button>
      </div>

      <div className="bg-[#f0f3ff] border-b border-[#E4E7EC] px-8 py-3 -mx-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search RFQ or customer..."
              className="pl-9 pr-4 py-1.5 rounded-lg border border-[#E4E7EC] bg-white text-sm focus:outline-none focus:border-[#1769E0] w-56"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof STATUSES[number])}
            className="px-3 py-1.5 rounded-lg border border-[#E4E7EC] bg-white text-sm focus:outline-none focus:border-[#1769E0]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === "All" ? "Status (All)" : s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof PRIORITIES[number])}
            className="px-3 py-1.5 rounded-lg border border-[#E4E7EC] bg-white text-sm focus:outline-none focus:border-[#1769E0]"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p === "All" ? "Priority (All)" : p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#44474d]">
          <span>Showing {filtered.length} of {total}</span>
          <button className="w-7 h-7 border border-[#E4E7EC] rounded bg-white flex items-center justify-center hover:bg-[#e8eeff]"><ChevronLeft size={14} /></button>
          <button className="w-7 h-7 border border-[#E4E7EC] rounded bg-white flex items-center justify-center hover:bg-[#e8eeff]"><ChevronRight size={14} /></button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-[#44474d]">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading RFQs…
        </div>
      )}

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-600">{error}</div>
      )}

      {!loading && !error && (
        <div className="flex-1 bg-white border border-[#E4E7EC] rounded-xl overflow-hidden mt-6 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                <tr>
                  {["RFQ #", "Customer", "Company", "Items", "Status", "Priority", "Date", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-label-md text-[#44474d] text-sm font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[#44474d] text-sm">
                      No RFQs found.
                    </td>
                  </tr>
                ) : filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[#f0f3ff]/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-[#1769E0] font-medium text-sm">
                      <Link href={`/admin/rfqs/${r.id}`} className="hover:underline">{r.rfqNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-[#111c2d] text-sm">
                      {r.customer.user.firstName} {r.customer.user.lastName}
                    </td>
                    <td className="px-4 py-3 text-[#111c2d] text-sm">{r.customer.company.name}</td>
                    <td className="px-4 py-3 text-[#111c2d] text-sm font-mono">{r.items?.length ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status.toLowerCase()} /></td>
                    <td className="px-4 py-3">
                      <span className={`capitalize text-xs font-semibold ${PRIORITY_COLOR[r.priority] ?? ""}`}>{r.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-[#44474d] text-xs font-mono">{r.createdAt.split("T")[0]}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/rfqs/${r.id}`} className="text-[#1769E0] hover:underline text-xs">View</Link>
                    </td>
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
