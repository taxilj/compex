"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiError } from "@/lib/api/client";
import { getCustomerOrder, type SalesOrder } from "@/lib/api/orders";
function money(value: string | number, currency: string) { return `${currency} ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`; }
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>(); const [order, setOrder] = useState<SalesOrder | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) getCustomerOrder(id).then(setOrder).catch((e) => setError(e instanceof ApiError ? e.message : "Unable to load order.")); }, [id]);
  if (error) return <div className="max-w-[1280px] mx-auto py-16 text-center text-[#B42318]">{error}</div>; if (!order) return <div className="flex justify-center py-20 text-[#44474d]"><Loader2 size={22} className="animate-spin mr-2" /> Loading order…</div>;
  return <div className="max-w-[1280px] mx-auto space-y-6"><div className="flex items-center gap-3"><Link href="/portal/orders" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff]"><ArrowLeft size={20} /></Link><h1 className="font-headline-lg text-[#111c2d]">{order.orderNumber}</h1><StatusBadge status={order.status.toLowerCase()} /></div><div className="bg-white rounded-lg border border-[#E4E7EC] p-6"><h2 className="font-headline-sm text-[#111c2d] mb-4">Order Items</h2><div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead><tr className="bg-[#f0f3ff]"><th className="py-2.5 px-4 text-left font-label-sm">MPN</th><th className="py-2.5 px-4 text-left font-label-sm">Manufacturer</th><th className="py-2.5 px-4 text-right font-label-sm">Qty</th><th className="py-2.5 px-4 text-right font-label-sm">Unit Price</th><th className="py-2.5 px-4 text-right font-label-sm">Total</th></tr></thead><tbody className="divide-y divide-[#E4E7EC]">{order.items.map((item) => <tr key={item.id}><td className="py-3 px-4 font-mono-label">{item.mpn}</td><td className="py-3 px-4">{item.manufacturer ?? "—"}</td><td className="py-3 px-4 text-right">{item.quantity}</td><td className="py-3 px-4 text-right">{money(item.unitPrice, order.currency)}</td><td className="py-3 px-4 text-right">{money(item.lineTotal, order.currency)}</td></tr>)}</tbody></table></div><div className="border-t border-[#E4E7EC] pt-4 mt-4 flex justify-end"><div className="space-y-2 text-right"><p className="font-body-sm">Subtotal: {money(order.subtotal, order.currency)}</p><p className="font-body-sm">Tax: {money(order.tax, order.currency)}</p><p className="font-label-md">Total: {money(order.total, order.currency)}</p></div></div></div></div>;
}
