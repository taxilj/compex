import Link from "next/link";
import { shipments } from "@/data/mock/shipments";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Package, MapPin, Calendar, ArrowRight } from "lucide-react";

export default function ShipmentsPage() {
  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="font-headline-lg text-[#111c2d]">Shipments</h1>
        <p className="font-body-md text-[#44474d] mt-1">{shipments.length} total shipments</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {shipments.map((shp) => (
          <div key={shp.id} className="bg-white rounded-lg border border-[#E4E7EC] p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-mono-label text-[#0B1F3A] font-medium">{shp.trackingNumber}</p>
                <p className="font-body-sm text-[#44474d]">Order: {shp.orderNumber}</p>
              </div>
              <StatusBadge status={shp.status} />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1 font-body-sm text-[#44474d]">
                <MapPin size={14} /> {shp.origin}
              </div>
              <ArrowRight size={16} className="text-[#E4E7EC] shrink-0" />
              <div className="flex items-center gap-1 font-body-sm text-[#111c2d]">
                <MapPin size={14} /> {shp.destination}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 font-body-sm text-[#44474d]">
                <Calendar size={14} /> ETA: {shp.eta}
              </div>
              <div className="flex items-center gap-1 font-body-sm text-[#44474d]">
                <Package size={14} /> {shp.carrier}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#E4E7EC]">
              <Link href={`/portal/shipments/${shp.id}`} className="font-label-md text-[#1769E0] hover:underline text-sm flex items-center gap-1">
                Track Shipment <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}