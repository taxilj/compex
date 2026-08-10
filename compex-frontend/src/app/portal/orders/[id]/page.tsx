import { orders } from "@/data/mock/orders";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Timeline } from "@/components/ui/Timeline";
import { ArrowLeft, MapPin, Calendar } from "lucide-react";
import type { TimelineStep } from "@/types";

interface Props { params: Promise<{ id: string }> }

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = orders.find((o) => o.id === id);
  if (!order) notFound();

  const steps: TimelineStep[] = [
    { label: "Order Confirmed", date: order.createdAt.split("T")[0], completed: true },
    { label: "Procurement Started", date: "2026-07-26", completed: true },
    { label: "Supplier Processing", completed: order.status !== "processing" },
    { label: "International Shipment", completed: order.status === "shipped" || order.status === "delivered" },
    { label: "Customs Clearance", completed: order.status === "delivered" },
    { label: "India Delivery", completed: order.status === "delivered" },
    { label: "Delivered", date: order.status === "delivered" ? order.estimatedDelivery : undefined, completed: order.status === "delivered" },
  ];

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal/orders" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-headline-lg text-[#111c2d]">{order.number}</h1>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">Order Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="bg-[#f0f3ff]">
                    {["MPN", "Manufacturer", "Qty", "Unit Price", "Total"].map((h) => (
                      <th key={h} className="py-2.5 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 px-4 font-mono-label text-[#0B1F3A] font-medium">{item.mpn}</td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">{item.manufacturer}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">{item.quantity.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d] font-medium">₹{item.totalPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#E4E7EC] pt-4 mt-4 flex flex-col items-end gap-1">
              <div className="flex gap-12 text-[#44474d] font-body-sm"><span>Subtotal</span><span>₹{order.subtotal.toLocaleString()}</span></div>
              <div className="flex gap-12 text-[#44474d] font-body-sm"><span>GST (18%)</span><span>₹{order.gstAmount.toLocaleString()}</span></div>
              <div className="flex gap-12 font-label-md text-[#111c2d]"><span>Grand Total</span><span className="font-headline-sm">₹{order.grandTotal.toLocaleString()}</span></div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">Delivery Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2 text-[#44474d]">
                <MapPin size={16} className="mt-0.5" />
                <div>
                  <p className="font-label-sm uppercase tracking-wider text-xs mb-1">Delivery Address</p>
                  <p className="font-body-sm text-[#111c2d]">{order.deliveryAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[#44474d]">
                <Calendar size={16} className="mt-0.5" />
                <div>
                  <p className="font-label-sm uppercase tracking-wider text-xs mb-1">Est. Delivery</p>
                  <p className="font-body-md text-[#111c2d]">{order.estimatedDelivery}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-6">Order Progress</h2>
            <Timeline steps={steps} />
          </div>
        </div>
      </div>
    </div>
  );
}