"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { listAdminRfqs, type AdminRfq } from "@/lib/api/admin";

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: "text-[#F04438]",
  MEDIUM: "text-[#F79009]",
  LOW: "text-[#12B76A]",
};

export function RecentRfqsTable() {
  const [rfqs, setRfqs] = useState<Array<AdminRfq & { ageHours: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAdminRfqs({ limit: 5 })
      .then((res) => setRfqs(res.data.map((rfq) => ({
        ...rfq,
        ageHours: Math.floor((Date.now() - new Date(rfq.createdAt).getTime()) / 3600000),
      }))))
      .catch(() => {/* keep empty on error */})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="xl:col-span-2 bg-white rounded-lg border border-[#E4E7EC] shadow-sm">
      <div className="p-5 border-b border-[#E4E7EC] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-headline-sm text-[#111c2d]">Recent RFQs</h3>
          <span className="bg-[#e8eeff] px-2 py-0.5 rounded font-label-sm text-xs text-[#44474d]">Live</span>
        </div>
        <Link href="/admin/rfqs" className="font-label-md text-[#1769E0] hover:underline text-sm flex items-center gap-1">
          View All <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-[#44474d]">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading…
          </div>
        ) : rfqs.length === 0 ? (
          <p className="py-8 text-center font-body-sm text-[#44474d]">No RFQs yet.</p>
        ) : (
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="bg-[#f0f3ff]">
                {["RFQ #", "Customer", "Status", "Priority", "Age"].map((h) => (
                  <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {rfqs.map((r) => (
                <tr key={r.id} className="hover:bg-[#f0f3ff]/30 transition-colors">
                  <td className="py-3 px-5 font-mono text-[#1769E0] font-medium">
                    <Link href={`/admin/rfqs/${r.id}`} className="hover:underline">{r.rfqNumber}</Link>
                  </td>
                  <td className="py-3 px-5 font-body-sm text-[#111c2d]">{r.customer.company.name}</td>
                  <td className="py-3 px-5"><StatusBadge status={r.status.toLowerCase()} /></td>
                  <td className="py-3 px-5">
                    <span className={`capitalize text-xs font-semibold ${PRIORITY_COLOR[r.priority] ?? ""}`}>{r.priority}</span>
                  </td>
                  <td className="py-3 px-5 font-mono-label text-sm text-[#44474d]">
                    {r.ageHours}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
