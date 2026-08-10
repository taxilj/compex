"use client";
import { quotes } from "@/data/mock/quotes";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowLeft, Download, CheckCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const quote = quotes.find((q) => q.id === params.id);
  if (!quote) notFound();

  const [accepted, setAccepted] = useState(false);

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal/quotes" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-headline-lg text-[#111c2d]">{quote.number}</h1>
          <StatusBadge status={accepted ? "accepted" : quote.status} />
        </div>
      </div>

      {accepted && (
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
              <span className="font-body-sm text-[#44474d]">Valid until: {quote.validUntil}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-[#f0f3ff]">
                    {["MPN", "Manufacturer", "Description", "Qty", "Unit Price", "Lead Time", "Total"].map((h) => (
                      <th key={h} className="py-2.5 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {quote.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#f0f3ff]/30">
                      <td className="py-3 px-4 font-mono-label text-[#0B1F3A] font-medium">{item.mpn}</td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">{item.manufacturer}</td>
                      <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[200px] truncate">{item.description}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">{item.quantity.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 font-body-sm text-[#44474d]">{item.leadTime}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d] font-medium">₹{item.totalPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Totals */}
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">Summary</h2>
            <div className="space-y-2.5">
              <div className="flex justify-between font-body-sm text-[#44474d]">
                <span>Subtotal</span><span>₹{quote.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-body-sm text-[#44474d]">
                <span>Shipping</span><span>₹{quote.shippingCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-body-sm text-[#44474d]">
                <span>GST (18%)</span><span>₹{quote.gstAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-label-md text-[#111c2d] border-t border-[#E4E7EC] pt-2.5">
                <span>Grand Total</span><span className="font-headline-sm">₹{quote.grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {!accepted && (
            <div className="space-y-3">
              <button
                onClick={() => setAccepted(true)}
                className="w-full bg-[#12B76A] text-white py-3 rounded font-label-md font-bold hover:bg-[#0fa35e] transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} /> Accept Quote
              </button>
              <button className="w-full border-2 border-[#0B1F3A] text-[#0B1F3A] py-3 rounded font-label-md hover:bg-[#e8eeff] transition-colors flex items-center justify-center gap-2">
                <RefreshCw size={18} /> Request Revision
              </button>
              <button className="w-full bg-[#f0f3ff] text-[#0B1F3A] py-3 rounded font-label-md hover:bg-[#e8eeff] transition-colors flex items-center justify-center gap-2">
                <Download size={18} /> Download PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}