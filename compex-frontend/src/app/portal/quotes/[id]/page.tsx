"use client";
import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowLeft, CheckCircle, RefreshCw } from "lucide-react";
import { getCustomerQuote, acceptQuote, rejectQuote, type CustomerQuote } from "@/lib/api/quotes";

function quoteStatus(status: string): string {
  const map: Record<string, string> = {
    SENT: "quote_sent", VIEWED: "quote_sent",
    ACCEPTED: "accepted", REJECTED: "rejected",
    EXPIRED: "rejected", DRAFT: "draft",
  };
  return map[status] ?? status.toLowerCase();
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<CustomerQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundErr, setNotFoundErr] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    getCustomerQuote(params.id)
      .then(setQuote)
      .catch(() => setNotFoundErr(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto py-12 text-center font-body-sm text-[#44474d]">
        Loading quotation…
      </div>
    );
  }

  if (notFoundErr || !quote) return notFound();

  const isAccepted = quote.status === "ACCEPTED";
  const isRejected = quote.status === "REJECTED";
  const canRespond = quote.status === "SENT" || quote.status === "VIEWED";

  async function handleAccept() {
    if (!window.confirm("Accept this quotation? This records your final response.")) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await acceptQuote(params.id);
      setQuote(updated);
    } catch {
      setActionError("The quotation could not be accepted. Refresh and try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    const reason = rejectionReason.trim();
    if (!reason) {
      setActionError("Enter a rejection reason before continuing.");
      return;
    }
    if (!window.confirm("Reject this quotation with the reason shown? This records your final response.")) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await rejectQuote(params.id, reason);
      setQuote(updated);
    } catch {
      setActionError("The quotation could not be rejected. Refresh and try again.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal/quotes" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-headline-lg text-[#111c2d]">{quote.quotationNumber}</h1>
          <StatusBadge status={quoteStatus(quote.status)} />
        </div>
      </div>

      {isAccepted && (
        <div className="bg-[#12B76A]/10 border border-[#12B76A]/30 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-[#12B76A]" />
          <p className="font-label-md text-[#12B76A]">Quote accepted! Our team will create your Sales Order shortly.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-sm text-[#111c2d]">Line Items</h2>
              <span className="font-body-sm text-[#44474d]">Valid until: {quote.validUntil.split("T")[0]}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-[#f0f3ff]">
                    {["MPN", "Description", "Qty", "Unit Price", "Total"].map((h) => (
                      <th key={h} className="py-2.5 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {quote.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#f0f3ff]/30">
                      <td className="py-3 px-4 font-mono-label text-[#0B1F3A] font-medium">{item.mpn}</td>
                      <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[200px] truncate">{item.description ?? item.mpn}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">{item.quantity.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">{quote.currency} {Number(item.unitPrice).toFixed(2)}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d] font-medium">{quote.currency} {Number(item.lineTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(quote.deliveryTerms || quote.paymentTerms) && (
            <div className="bg-white rounded-lg border border-[#E4E7EC] p-6 space-y-2">
              <h2 className="font-headline-sm text-[#111c2d] mb-3">Terms</h2>
              {quote.deliveryTerms && <p className="font-body-sm text-[#44474d]"><span className="font-label-sm text-[#111c2d]">Delivery: </span>{quote.deliveryTerms}</p>}
              {quote.paymentTerms && <p className="font-body-sm text-[#44474d]"><span className="font-label-sm text-[#111c2d]">Payment: </span>{quote.paymentTerms}</p>}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">Summary</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between font-body-sm text-[#44474d]">
                <span>Subtotal</span><span>{quote.currency} {Number(quote.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-body-sm text-[#44474d]">
                <span>Tax</span><span>{quote.currency} {Number(quote.tax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-label-md text-[#111c2d] border-t border-[#E4E7EC] pt-2.5">
                <span>Grand Total</span><span className="font-headline-sm">{quote.currency} {Number(quote.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {canRespond && (
            <div className="space-y-3">
              {actionError && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-3 py-2 font-body-sm text-[#B42318]">{actionError}</p>}
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="w-full bg-[#12B76A] text-white py-3 rounded font-label-md font-bold hover:bg-[#0fa35e] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <CheckCircle size={18} /> {actionLoading ? "Processing…" : "Accept Quote"}
              </button>
              <label htmlFor="rejection-reason" className="block font-label-sm text-[#44474d]">Rejection reason</label>
              <textarea id="rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} rows={3} placeholder="Explain what needs to change…" className="w-full rounded border border-[#E4E7EC] px-3 py-2 font-body-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="w-full border-2 border-[#F04438] text-[#F04438] py-3 rounded font-label-md hover:bg-[#fff1f0] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RefreshCw size={18} /> {actionLoading ? "Processing…" : "Reject Quote"}
              </button>
            </div>
          )}

          {isRejected && (
            <div className="bg-[#F04438]/10 border border-[#F04438]/30 rounded-lg p-4">
              <p className="font-label-md text-[#F04438]">Quote rejected. Contact us to discuss your requirements.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
