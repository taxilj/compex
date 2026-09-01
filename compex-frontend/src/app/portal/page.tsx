"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ClipboardList, ArrowUpRight, Clock, Loader2 } from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { listRfqs, type BackendRfq } from "@/lib/api/rfqs";
import { listCustomerQuotes } from "@/lib/api/quotes";
import { useAuth } from "@/contexts/AuthContext";

export default function PortalDashboardPage() {
  const { companyName } = useAuth();
  const [rfqs, setRfqs] = useState<BackendRfq[]>([]);
  const [quoteCount, setQuoteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Fetch up to the backend's page cap (not just the 4 shown below) so the
    // "Open RFQs" stat card counts the customer's real open RFQs, not just
    // whichever 4 happened to be the most recent.
    Promise.all([listRfqs({ limit: 100 }), listCustomerQuotes({ limit: 1 })])
      .then(([rfqResult, quoteResult]) => { setRfqs(rfqResult); setQuoteCount(quoteResult.total); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const recentRFQs = rfqs.slice(0, 4);
  const displayName = companyName ? companyName.split(" ")[0] : "there";

  return (
    <div className="space-y-8 max-w-[1280px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-[#111c2d] mb-2">Welcome back, {displayName}</h1>
          <p className="font-body-md text-[#44474d]">Here is the latest overview of your procurement activities.</p>
        </div>
        <Link
          href="/portal/rfqs/new"
          className="bg-[#0B1F3A] text-white px-6 py-3 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors flex items-center gap-2 w-fit"
        >
          + New RFQ
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard label="Open RFQs" value={rfqs.filter(r => r.status === "DRAFT" || r.status === "SUBMITTED" || r.status === "UNDER_REVIEW" || r.status === "SOURCING").length} icon={FileText} />
        <StatsCard label="Customer Quotations" value={quoteCount} icon={ClipboardList} iconClassName="bg-[#12B76A]/10" />
      </div>

      {error && <p role="alert" className="rounded-lg border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 font-body-sm text-[#B42318]">Dashboard data could not be loaded. Refresh the page or sign in again.</p>}

      <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm">
        <div className="p-5 border-b border-[#E4E7EC] flex items-center justify-between">
          <h2 className="font-headline-sm text-[#111c2d]">Recent RFQs</h2>
          <Link href="/portal/rfqs" className="font-label-md text-[#1769E0] hover:underline text-sm flex items-center gap-1">
            View All <ArrowUpRight size={14} />
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10 text-[#44474d]">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        )}

        {!loading && recentRFQs.length === 0 && (
          <div className="p-8 text-center">
            <p className="font-body-md text-[#44474d]">No RFQs yet. <Link href="/portal/rfqs/new" className="text-[#1769E0] hover:underline">Create your first one.</Link></p>
          </div>
        )}

        {!loading && recentRFQs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-[#f0f3ff]">
                  {["RFQ #", "Items", "City", "Required Date", "Status", "Action"].map((h) => (
                    <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {recentRFQs.map((rfq) => (
                  <tr key={rfq.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                    <td className="py-3 px-5">
                      <Link href={`/portal/rfqs/${rfq.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">
                        {rfq.rfqNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-5 font-body-sm text-[#111c2d]">{rfq._count?.items ?? rfq.items?.length ?? 0} items</td>
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
        )}
      </div>

    </div>
  );
}
