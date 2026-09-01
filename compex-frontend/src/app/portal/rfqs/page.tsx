"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { listRfqs, type BackendRfq } from "@/lib/api/rfqs";
import { Plus, Clock, Loader2 } from "lucide-react";

export default function RFQsPage() {
  const [rfqs, setRfqs] = useState<BackendRfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRfqs()
      .then(setRfqs)
      .catch(() => setError("Failed to load RFQs. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">My RFQs</h1>
          <p className="font-body-md text-[#44474d] mt-1">{loading ? "Loading…" : `${rfqs.length} total requests`}</p>
        </div>
        <Link href="/portal/rfqs/new" className="flex items-center gap-2 bg-[#0B1F3A] text-white px-5 py-2.5 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors">
          <Plus size={18} /> New RFQ
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-[#44474d]">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading RFQs…
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-600">{error}</div>
      )}

      {!loading && !error && rfqs.length === 0 && (
        <div className="bg-white rounded-lg border border-[#E4E7EC] p-12 text-center">
          <p className="font-headline-sm text-[#44474d] mb-2">No RFQs yet</p>
          <p className="font-body-md text-[#44474d] mb-6">Create your first Request for Quotation to get started.</p>
          <Link href="/portal/rfqs/new" className="inline-flex items-center gap-2 bg-[#0B1F3A] text-white px-5 py-2.5 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors">
            <Plus size={18} /> New RFQ
          </Link>
        </div>
      )}

      {!loading && !error && rfqs.length > 0 && (
        <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-[#f0f3ff]">
                  {["RFQ #", "Date", "Items", "City", "Required Date", "Status", ""].map((h) => (
                    <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {rfqs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                    <td className="py-3 px-5">
                      <Link href={`/portal/rfqs/${rfq.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{rfq.rfqNumber}</Link>
                    </td>
                    <td className="py-3 px-5 font-body-sm text-[#44474d]">{rfq.createdAt.split("T")[0]}</td>
                    <td className="py-3 px-5 font-body-sm text-[#111c2d]">{rfq._count?.items ?? rfq.items?.length ?? 0}</td>
                    <td className="py-3 px-5 font-body-sm text-[#111c2d]">{rfq.deliveryLocation ?? "—"}</td>
                    <td className="py-3 px-5 font-body-sm text-[#44474d]">
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> {rfq.requiredDate?.split("T")[0] ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 px-5"><StatusBadge status={rfq.status.toLowerCase()} /></td>
                    <td className="py-3 px-5">
                      <Link href={`/portal/rfqs/${rfq.id}`} className="font-label-sm text-[#1769E0] hover:underline text-xs">View</Link>
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
