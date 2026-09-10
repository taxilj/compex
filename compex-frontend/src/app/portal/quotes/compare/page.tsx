"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listCustomerQuotes, acceptQuote, type CustomerQuote } from "@/lib/api/quotes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowLeft, CheckCircle, ExternalLink, Loader2 } from "lucide-react";

function quoteStatus(status: string): string {
  const map: Record<string, string> = {
    SENT: "quote_sent",
    VIEWED: "quote_sent",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    EXPIRED: "rejected",
    DRAFT: "draft",
  };
  return map[status] ?? status.toLowerCase();
}

export default function QuoteComparePage() {
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    listCustomerQuotes()
      .then((res) => setQuotes(res.data.filter((q) => q.status === "SENT" || q.status === "VIEWED")))
      .catch((err) => {
        console.error("Failed to load quotations:", err);
        setError("Failed to load quotations.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAccept(id: string) {
    if (acceptingIds.has(id)) return;
    if (!window.confirm("Accept this quotation? This records your final response.")) return;
    setAcceptingIds((prev) => new Set(prev).add(id));
    setAcceptError(null);
    try {
      const updated = await acceptQuote(id);
      setQuotes((prev) => prev.map((q) => (q.id === id ? updated : q)).filter((q) => q.status === "SENT" || q.status === "VIEWED"));
    } catch (err) {
      console.error(`Failed to accept quote ${id}:`, err);
      setAcceptError("The quotation could not be accepted. Refresh and try again.");
    } finally {
      setAcceptingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/portal/quotes"
          className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Compare Quotes</h1>
          <p className="font-body-md text-[#44474d] mt-0.5">
            Review your open quotations awaiting a response
          </p>
        </div>
      </div>

      {acceptError && (
        <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-3 py-2 font-body-sm text-[#B42318]">
          {acceptError}
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-[#44474d]">
          <Loader2 size={22} className="animate-spin mr-2" /> Loading quotations…
        </div>
      )}

      {!loading && error && <p className="font-body-sm text-red-600">{error}</p>}

      {!loading && !error && quotes.length === 0 && (
        <div className="bg-white rounded-lg border border-[#E4E7EC] p-16 flex flex-col items-center text-center gap-3">
          <h2 className="font-headline-sm text-[#111c2d]">No quotes to compare</h2>
          <p className="font-body-md text-[#44474d]">
            Quotes awaiting your response will appear here once our team sends them.
          </p>
          <Link href="/portal/quotes" className="text-[#1769E0] hover:underline font-label-md">
            View all quotes
          </Link>
        </div>
      )}

      {!loading && quotes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {quotes.map((quote) => (
            <div key={quote.id} className="bg-white rounded-lg border-2 border-[#E4E7EC] overflow-hidden">
              <div className="px-6 py-4 flex items-start justify-between bg-[#f0f3ff]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-headline-sm text-[#111c2d]">{quote.quotationNumber}</span>
                    <StatusBadge status={quoteStatus(quote.status)} />
                  </div>
                  <p className="font-body-sm text-[#44474d]">RFQ Ref: {quote.rfq.rfqNumber}</p>
                  <p className="font-body-sm text-[#44474d]">Valid until: {quote.validUntil.split("T")[0]}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="bg-[#f9f9ff]">
                      {["Part Number", "Qty", "Unit Price", "Total"].map((h) => (
                        <th key={h} className="py-2 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider text-xs">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7EC]">
                    {quote.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#f9f9ff]">
                        <td className="py-2.5 px-4">
                          <p className="font-mono-label text-[#0B1F3A] font-medium text-sm">{item.mpn}</p>
                        </td>
                        <td className="py-2.5 px-4 font-mono-label text-[#111c2d] text-sm">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono-label text-[#111c2d] text-sm">
                          {quote.currency} {Number(item.unitPrice).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 font-mono-label text-[#111c2d] font-medium text-sm">
                          {quote.currency} {Number(item.lineTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-[#E4E7EC] space-y-1.5">
                <div className="flex justify-between font-body-sm text-[#44474d]">
                  <span>Subtotal</span>
                  <span>{quote.currency} {Number(quote.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-body-sm text-[#44474d]">
                  <span>Tax</span>
                  <span>{quote.currency} {Number(quote.tax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-label-md text-[#111c2d] border-t border-[#E4E7EC] pt-2">
                  <span>Grand Total</span>
                  <span className="font-headline-sm">{quote.currency} {Number(quote.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="px-6 pb-5 flex gap-2">
                <button
                  onClick={() => handleAccept(quote.id)}
                  disabled={acceptingIds.has(quote.id)}
                  className="flex-1 py-2.5 rounded font-label-md transition-colors flex items-center justify-center gap-2 bg-[#12B76A] text-white hover:bg-[#0fa35e] disabled:opacity-60"
                >
                  <CheckCircle size={16} />
                  {acceptingIds.has(quote.id) ? "Accepting…" : "Accept Quote"}
                </button>
                <Link
                  href={`/portal/quotes/${quote.id}`}
                  className="px-3 py-2.5 border border-[#E4E7EC] text-[#44474d] rounded font-label-md hover:bg-[#f0f3ff] transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink size={15} />
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
