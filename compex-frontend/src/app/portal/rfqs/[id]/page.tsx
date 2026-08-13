"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Timeline } from "@/components/ui/Timeline";
import type { TimelineStep } from "@/types";
import { getRfq, type BackendRfq, type BackendRfqItem } from "@/lib/api/rfqs";
import { ApiError } from "@/lib/api/client";
import { ArrowLeft, Clock, MapPin, Loader2 } from "lucide-react";

export default function RFQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rfq, setRfq] = useState<(BackendRfq & { items: BackendRfqItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    getRfq(id)
      .then(setRfq)
      .catch((err) => {
        if (err instanceof ApiError && err.statusCode === 404) setNotFound(true);
        else setError("Failed to load RFQ. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#44474d]">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading RFQ…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-[860px] mx-auto py-20 text-center">
        <h1 className="font-headline-lg text-[#111c2d] mb-2">RFQ Not Found</h1>
        <p className="font-body-md text-[#44474d] mb-6">This RFQ does not exist or you do not have access to it.</p>
        <Link href="/portal/rfqs" className="text-[#1769E0] hover:underline font-label-md">← Back to RFQs</Link>
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="max-w-[860px] mx-auto py-20 text-center">
        <p className="font-body-md text-red-600">{error ?? "An error occurred."}</p>
        <Link href="/portal/rfqs" className="text-[#1769E0] hover:underline font-label-md mt-4 block">← Back to RFQs</Link>
      </div>
    );
  }

  const statusLower = rfq.status.toLowerCase();

  const steps: TimelineStep[] = [
    { label: "RFQ Submitted", date: rfq.submittedAt?.split("T")[0] ?? rfq.createdAt.split("T")[0], completed: rfq.status !== "DRAFT" },
    { label: "Requirement Reviewed", completed: rfq.status === "UNDER_REVIEW" || rfq.status === "SOURCING" },
    { label: "Supplier Sourcing", completed: rfq.status === "SOURCING", current: rfq.status === "SOURCING" },
    { label: "Quote Preparation", completed: false },
    { label: "Quote Sent", completed: false },
  ];

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal/rfqs" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-[#111c2d]">{rfq.rfqNumber}</h1>
            <StatusBadge status={statusLower} />
          </div>
          <p className="font-body-sm text-[#44474d]">Created {rfq.createdAt.split("T")[0]}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">BOM Items</h2>
            {rfq.items.length === 0 ? (
              <p className="font-body-sm text-[#44474d]">No items added yet.</p>
            ) : (
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
                        <td className="py-3 px-4 font-body-sm text-[#111c2d]">{item.manufacturer ?? "—"}</td>
                        <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[200px] truncate">{item.description ?? "—"}</td>
                        <td className="py-3 px-4 font-mono-label text-[#111c2d]">{item.quantity.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">RFQ Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-[#44474d]">
                <MapPin size={16} />
                <div>
                  <p className="font-label-sm uppercase tracking-wider text-xs">Delivery Location</p>
                  <p className="font-body-md text-[#111c2d]">{rfq.deliveryLocation ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[#44474d]">
                <Clock size={16} />
                <div>
                  <p className="font-label-sm uppercase tracking-wider text-xs">Required By</p>
                  <p className="font-body-md text-[#111c2d]">{rfq.requiredDate?.split("T")[0] ?? "—"}</p>
                </div>
              </div>
            </div>
            {rfq.additionalNotes && (
              <div className="mt-4 p-3 bg-[#f0f3ff] rounded">
                <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-1">Notes</p>
                <p className="font-body-sm text-[#111c2d]">{rfq.additionalNotes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-6">Progress</h2>
            <Timeline steps={steps} />
          </div>
        </div>
      </div>
    </div>
  );
}
