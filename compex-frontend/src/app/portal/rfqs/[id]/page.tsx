import { rfqs } from "@/data/mock/rfqs";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Timeline } from "@/components/ui/Timeline";
import type { TimelineStep } from "@/types";
import { ArrowLeft, Clock, MapPin, User } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

export default async function RFQDetailPage({ params }: Props) {
  const { id } = await params;
  const rfq = rfqs.find((r) => r.id === id);
  if (!rfq) notFound();

  const steps: TimelineStep[] = [
    { label: "RFQ Submitted", date: rfq.createdAt.split("T")[0], completed: true },
    { label: "Requirement Reviewed", date: "2026-08-09", completed: true },
    { label: "Supplier Sourcing", completed: rfq.status === "sourcing" || rfq.status === "quote_ready", current: rfq.status === "sourcing" },
    { label: "Quote Preparation", completed: rfq.status === "quote_ready" },
    { label: "Quote Sent", completed: rfq.status === "quote_sent" },
  ];

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal/rfqs" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-[#111c2d]">{rfq.number}</h1>
            <StatusBadge status={rfq.status} />
          </div>
          <p className="font-body-sm text-[#44474d]">Submitted {rfq.createdAt.split("T")[0]}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* BOM Items */}
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">BOM Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="bg-[#f0f3ff]">
                    {["#", "MPN", "Manufacturer", "Description", "Qty"].map((h) => (
                      <th key={h} className="py-2.5 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {rfq.items.map((item, i) => (
                    <tr key={item.id} className="hover:bg-[#f0f3ff]/30">
                      <td className="py-3 px-4 font-body-sm text-[#44474d]">{i + 1}</td>
                      <td className="py-3 px-4 font-mono-label text-[#0B1F3A] font-medium">{item.mpn}</td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">{item.manufacturer || "—"}</td>
                      <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[200px] truncate">{item.description || "—"}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">{item.quantity.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">RFQ Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-[#44474d]">
                <MapPin size={16} />
                <div>
                  <p className="font-label-sm uppercase tracking-wider text-xs">Delivery City</p>
                  <p className="font-body-md text-[#111c2d]">{rfq.deliveryCity}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[#44474d]">
                <Clock size={16} />
                <div>
                  <p className="font-label-sm uppercase tracking-wider text-xs">Required By</p>
                  <p className="font-body-md text-[#111c2d]">{rfq.requiredDate}</p>
                </div>
              </div>
              {rfq.assignedTo && (
                <div className="flex items-center gap-2 text-[#44474d]">
                  <User size={16} />
                  <div>
                    <p className="font-label-sm uppercase tracking-wider text-xs">Assigned To</p>
                    <p className="font-body-md text-[#111c2d]">{rfq.assignedTo}</p>
                  </div>
                </div>
              )}
              {rfq.estimatedValue && (
                <div>
                  <p className="font-label-sm uppercase tracking-wider text-xs text-[#44474d]">Est. Value</p>
                  <p className="font-body-md text-[#111c2d]">₹{(rfq.estimatedValue / 100000).toFixed(1)}L</p>
                </div>
              )}
            </div>
            {rfq.additionalNotes && (
              <div className="mt-4 p-3 bg-[#f0f3ff] rounded">
                <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-1">Notes</p>
                <p className="font-body-sm text-[#111c2d]">{rfq.additionalNotes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-6">Progress</h2>
            <Timeline steps={steps} />
          </div>
          {rfq.status === "quote_ready" && (
            <div className="bg-[#12B76A]/10 border border-[#12B76A]/20 rounded-lg p-4">
              <p className="font-label-md text-[#12B76A] mb-2">Quote Ready!</p>
              <p className="font-body-sm text-[#44474d] mb-3">Your quotation is ready for review.</p>
              <Link href="/portal/quotes/q1" className="w-full bg-[#1769E0] text-white py-2 rounded font-label-md text-sm text-center block hover:bg-[#1257b8] transition-colors">
                View Quote
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}