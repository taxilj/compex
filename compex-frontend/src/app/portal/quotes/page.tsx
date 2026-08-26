"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { listCustomerQuotes, type CustomerQuote } from "@/lib/api/quotes";

function quoteStatus(status: string): string {
  const map: Record<string, string> = {
    SENT: "quote_sent", VIEWED: "quote_sent",
    ACCEPTED: "accepted", REJECTED: "rejected",
    EXPIRED: "rejected", DRAFT: "draft",
  };
  return map[status] ?? status.toLowerCase();
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomerQuotes()
      .then((res) => { setQuotes(res.data); setTotal(res.total); })
      .catch(() => setError("Failed to load quotations."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Quotes</h1>
          <p className="font-body-md text-[#44474d] mt-1">{loading ? "Loading…" : `${total} quotations`}</p>
        </div>
      </div>

      {error && <p className="text-[#F04438] font-body-sm">{error}</p>}

      <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#f0f3ff]">
                {["Quote #", "RFQ", "Date", "Items", "Grand Total", "Valid Until", "Status", ""].map((h) => (
                  <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {loading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center font-body-sm text-[#44474d]">Loading quotations…</td>
                </tr>
              )}
              {!loading && quotes.length === 0 && !error && (
                <tr>
                  <td colSpan={8} className="py-8 text-center font-body-sm text-[#44474d]">No quotations yet.</td>
                </tr>
              )}
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                  <td className="py-3 px-5"><Link href={`/portal/quotes/${q.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{q.quotationNumber}</Link></td>
                  <td className="py-3 px-5 font-mono-label text-[#44474d]">{q.rfq.rfqNumber}</td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d]">{q.createdAt.split("T")[0]}</td>
                  <td className="py-3 px-5 font-body-sm text-[#111c2d]">{q.items.length}</td>
                  <td className="py-3 px-5 font-mono-label text-[#111c2d] font-medium">{q.currency} {Number(q.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d]">{q.validUntil.split("T")[0]}</td>
                  <td className="py-3 px-5"><StatusBadge status={quoteStatus(q.status)} /></td>
                  <td className="py-3 px-5"><Link href={`/portal/quotes/${q.id}`} className="font-label-sm text-[#1769E0] hover:underline text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
