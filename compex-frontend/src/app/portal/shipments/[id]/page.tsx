import { shipments } from "@/data/mock/shipments";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ArrowLeft, Download, MapPin, ArrowRight, Check } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

export default async function ShipmentDetailPage({ params }: Props) {
  const { id } = await params;
  const shp = shipments.find((s) => s.id === id);
  if (!shp) notFound();

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal/shipments" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-headline-lg text-[#111c2d]">{shp.trackingNumber}</h1>
          <StatusBadge status={shp.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Route */}
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">Shipment Route</h2>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#e8eeff] flex items-center justify-center mx-auto mb-2">
                  <MapPin size={20} className="text-[#0B1F3A]" />
                </div>
                <p className="font-label-md text-[#111c2d] text-sm">{shp.origin}</p>
                <p className="font-label-sm text-[#44474d] text-xs">Origin</p>
              </div>
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1 h-px bg-[#E4E7EC]" />
                <ArrowRight size={20} className="text-[#1769E0] shrink-0" />
                <div className="flex-1 h-px bg-[#E4E7EC]" />
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#12B76A]/10 flex items-center justify-center mx-auto mb-2">
                  <MapPin size={20} className="text-[#12B76A]" />
                </div>
                <p className="font-label-md text-[#111c2d] text-sm">{shp.destination}</p>
                <p className="font-label-sm text-[#44474d] text-xs">Destination</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#E4E7EC]">
              <div>
                <p className="font-label-sm text-[#44474d] uppercase tracking-wider text-xs">Carrier</p>
                <p className="font-label-md text-[#111c2d]">{shp.carrier}</p>
              </div>
              <div>
                <p className="font-label-sm text-[#44474d] uppercase tracking-wider text-xs">ETA</p>
                <p className="font-label-md text-[#111c2d]">{shp.eta}</p>
              </div>
              <div>
                <p className="font-label-sm text-[#44474d] uppercase tracking-wider text-xs">Order</p>
                <p className="font-label-md text-[#111c2d]">{shp.orderNumber}</p>
              </div>
            </div>
          </div>

          {/* Events */}
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-6">Tracking Timeline</h2>
            <ol className="space-y-0">
              {shp.events.map((event, i) => {
                const isLast = i === shp.events.length - 1;
                return (
                  <li key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${event.completed ? "bg-[#1769E0] border-[#1769E0] text-white" : "bg-white border-[#E4E7EC] text-[#44474d]"}`}>
                        {event.completed ? <Check size={14} /> : <span className="w-2 h-2 rounded-full bg-[#E4E7EC]" />}
                      </div>
                      {!isLast && <div className={`w-0.5 flex-1 min-h-6 my-1 ${event.completed ? "bg-[#1769E0]" : "bg-[#E4E7EC]"}`} />}
                    </div>
                    <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
                      <p className={`font-label-md ${event.completed ? "text-[#111c2d]" : "text-[#44474d]"}`}>{event.description}</p>
                      <p className="font-body-sm text-[#44474d] text-xs">{event.location} · {event.date.split("T")[0]}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Documents */}
        <div>
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">Documents</h2>
            <div className="space-y-3">
              {shp.documents.map((doc) => (
                <div key={doc.name} className="flex items-center justify-between p-3 bg-[#f0f3ff] rounded border border-[#E4E7EC]">
                  <div>
                    <p className="font-label-md text-[#111c2d] text-sm">{doc.name}</p>
                    <p className="font-body-sm text-[#44474d] text-xs">{doc.type}</p>
                  </div>
                  <button className="p-2 text-[#1769E0] hover:text-[#1257b8]" aria-label={`Download ${doc.name}`}>
                    <Download size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}