"use client";
import { useState } from "react";
import Link from "next/link";
import { quotes } from "@/data/mock/quotes";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowLeft, CheckCircle, RefreshCw, ExternalLink } from "lucide-react";

export default function QuoteComparePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
            Review and compare your received quotations
          </p>
        </div>
      </div>

      {selectedId && (
        <div className="bg-[#12B76A]/10 border border-[#12B76A]/30 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-[#12B76A] shrink-0" />
          <p className="font-label-md text-[#12B76A]">
            Quote{" "}
            <strong>{quotes.find((q) => q.id === selectedId)?.number}</strong> selected. Our team
            will process your order shortly.
          </p>
          <button
            onClick={() => setSelectedId(null)}
            className="ml-auto font-label-sm text-[#12B76A] hover:underline"
          >
            Undo
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {quotes.map((quote) => {
          const isSelected = selectedId === quote.id;
          return (
            <div
              key={quote.id}
              className={`bg-white rounded-lg border-2 overflow-hidden transition-colors ${
                isSelected ? "border-[#12B76A]" : "border-[#E4E7EC]"
              }`}
            >
              {/* Quote header */}
              <div
                className={`px-6 py-4 flex items-start justify-between ${
                  isSelected ? "bg-[#12B76A]/5" : "bg-[#f0f3ff]"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-headline-sm text-[#111c2d]">{quote.number}</span>
                    <StatusBadge status={quote.status} />
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#12B76A] text-white rounded text-xs font-bold">
                        <CheckCircle size={10} /> Selected
                      </span>
                    )}
                  </div>
                  <p className="font-body-sm text-[#44474d]">RFQ Ref: {quote.rfqNumber}</p>
                  <p className="font-body-sm text-[#44474d]">Valid until: {quote.validUntil}</p>
                </div>
              </div>

              {/* Line items */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="bg-[#f9f9ff]">
                      {["Part Number", "Qty", "Unit Price", "Lead Time", "Total"].map((h) => (
                        <th
                          key={h}
                          className="py-2 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider text-xs"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7EC]">
                    {quote.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#f9f9ff]">
                        <td className="py-2.5 px-4">
                          <p className="font-mono-label text-[#0B1F3A] font-medium text-sm">
                            {item.mpn}
                          </p>
                          <p className="font-body-sm text-[#44474d] text-xs">{item.availability}</p>
                        </td>
                        <td className="py-2.5 px-4 font-mono-label text-[#111c2d] text-sm">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-mono-label text-[#111c2d] text-sm">
                          ₹{item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 font-body-sm text-[#44474d] text-sm">
                          {item.leadTime}
                        </td>
                        <td className="py-2.5 px-4 font-mono-label text-[#111c2d] font-medium text-sm">
                          ₹{item.totalPrice.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="px-6 py-4 border-t border-[#E4E7EC] space-y-1.5">
                <div className="flex justify-between font-body-sm text-[#44474d]">
                  <span>Subtotal</span>
                  <span>₹{quote.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-body-sm text-[#44474d]">
                  <span>Shipping</span>
                  <span>₹{quote.shippingCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-body-sm text-[#44474d]">
                  <span>GST (18%)</span>
                  <span>₹{quote.gstAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-label-md text-[#111c2d] border-t border-[#E4E7EC] pt-2">
                  <span>Grand Total</span>
                  <span className="font-headline-sm">₹{quote.grandTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 pb-5 flex gap-2">
                <button
                  onClick={() => setSelectedId(isSelected ? null : quote.id)}
                  className={`flex-1 py-2.5 rounded font-label-md transition-colors flex items-center justify-center gap-2 ${
                    isSelected
                      ? "bg-[#12B76A] text-white hover:bg-[#0fa35e]"
                      : "bg-[#0B1F3A] text-white hover:bg-[#1a3357]"
                  }`}
                >
                  <CheckCircle size={16} />
                  {isSelected ? "Selected" : "Select Quote"}
                </button>
                <button className="px-3 py-2.5 border border-[#E4E7EC] text-[#44474d] rounded font-label-md hover:bg-[#f0f3ff] transition-colors flex items-center gap-1.5">
                  <RefreshCw size={15} />
                  Revise
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
          );
        })}
      </div>
    </div>
  );
}