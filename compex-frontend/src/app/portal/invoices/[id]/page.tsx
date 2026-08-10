import { invoices } from "@/data/mock/invoices";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowLeft, Download, Printer, CheckCircle } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const inv = invoices.find((i) => i.id === id);
  if (!inv) notFound();

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal/invoices" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-headline-lg text-[#111c2d]">{inv.number}</h1>
          <StatusBadge status={inv.status} />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="flex items-center gap-2 border border-[#E4E7EC] text-[#44474d] px-4 py-2 rounded font-label-md text-sm hover:bg-[#f0f3ff] transition-colors">
            <Printer size={16} /> Print
          </button>
          <button className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md text-sm hover:bg-[#0B1F3A]/90 transition-colors">
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* Invoice preview */}
      <div className="bg-white rounded-lg border border-[#E4E7EC] p-8 shadow-sm">
        {/* Header */}
        <div className="flex justify-between mb-8 pb-8 border-b border-[#E4E7EC]">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded bg-[#0B1F3A] flex items-center justify-center">
                <span className="text-white font-bold">CX</span>
              </div>
              <div>
                <p className="font-headline-sm text-[#0B1F3A]">Compex Solution</p>
                <p className="font-body-sm text-[#44474d]">B2B Electronics Procurement</p>
              </div>
            </div>
            <p className="font-body-sm text-[#44474d]">GST: 07AABCC1234H1Z2</p>
            <p className="font-body-sm text-[#44474d]">New Delhi, India 110001</p>
          </div>
          <div className="text-right">
            <p className="font-headline-md text-[#0B1F3A] mb-1">TAX INVOICE</p>
            <p className="font-mono-label text-[#111c2d] font-medium">{inv.number}</p>
            <p className="font-body-sm text-[#44474d] mt-2">Invoice Date: {inv.invoiceDate}</p>
            <p className="font-body-sm text-[#44474d]">Due Date: {inv.dueDate}</p>
            {inv.paidDate && (
              <p className="font-label-md text-[#12B76A] mt-1 flex items-center justify-end gap-1">
                <CheckCircle size={14} /> Paid on {inv.paidDate}
              </p>
            )}
          </div>
        </div>

        {/* Bill to */}
        <div className="mb-8">
          <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-2">Bill To</p>
          <p className="font-label-md text-[#111c2d]">{inv.customerName}</p>
          <p className="font-body-sm text-[#44474d]">Order: {inv.orderNumber}</p>
        </div>

        {/* Items */}
        <table className="w-full mb-6">
          <thead>
            <tr className="bg-[#0B1F3A] text-white">
              <th className="py-3 px-4 text-left font-label-sm uppercase tracking-wider">Description</th>
              <th className="py-3 px-4 text-right font-label-sm uppercase tracking-wider">Qty</th>
              <th className="py-3 px-4 text-right font-label-sm uppercase tracking-wider">Unit Price</th>
              <th className="py-3 px-4 text-right font-label-sm uppercase tracking-wider">GST Rate</th>
              <th className="py-3 px-4 text-right font-label-sm uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EC]">
            {inv.items.map((item, i) => (
              <tr key={i} className="hover:bg-[#f0f3ff]/30">
                <td className="py-3 px-4 font-body-sm text-[#111c2d]">{item.description}</td>
                <td className="py-3 px-4 font-mono-label text-[#111c2d] text-right">{item.quantity}</td>
                <td className="py-3 px-4 font-mono-label text-[#111c2d] text-right">₹{item.unitPrice.toFixed(2)}</td>
                <td className="py-3 px-4 font-body-sm text-[#44474d] text-right">{item.gstRate}%</td>
                <td className="py-3 px-4 font-mono-label text-[#111c2d] font-medium text-right">₹{item.totalPrice.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2.5">
            <div className="flex justify-between font-body-sm text-[#44474d]"><span>Subtotal</span><span>₹{inv.subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between font-body-sm text-[#44474d]"><span>GST Amount</span><span>₹{inv.gstAmount.toLocaleString()}</span></div>
            <div className="flex justify-between font-label-md text-[#111c2d] border-t border-[#E4E7EC] pt-2.5 text-lg">
              <span>Grand Total</span><span className="font-bold">₹{inv.grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[#E4E7EC] text-center">
          <p className="font-body-sm text-[#44474d]">Thank you for your business. For queries: accounts@compexsolution.com</p>
        </div>
      </div>
    </div>
  );
}