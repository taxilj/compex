"use client";
import { useState, useMemo } from "react";
import { Search, Download } from "lucide-react";
import { Truck, Package, CheckCircle, Plane } from "lucide-react";

const SHIPMENT_STATUS = {
  processing: { label: "Processing", color: "bg-[#F79009]/10 text-[#F79009]", icon: Package },
  in_transit: { label: "In Transit", color: "bg-[#1769E0]/10 text-[#1769E0]", icon: Truck },
  customs: { label: "Customs", color: "bg-[#7B61FF]/10 text-[#7B61FF]", icon: Plane },
  out_for_delivery: { label: "Out for Delivery", color: "bg-[#F79009]/10 text-[#F79009]", icon: Truck },
  delivered: { label: "Delivered", color: "bg-[#12B76A]/10 text-[#12B76A]", icon: CheckCircle },
} as const;

type ShipmentStatus = keyof typeof SHIPMENT_STATUS;

const mockShipments = [
  { id: "SHP-2024-001", tracking: "DHL-7842391024", order: "SO-2024-001", carrier: "DHL Express", origin: "Frankfurt, DE", destination: "Bangalore, IN", eta: "2026-08-05", status: "delivered" as ShipmentStatus, weight: "4.2 kg" },
  { id: "SHP-2024-002", tracking: "FEDEX-8821947302", order: "SO-2024-002", carrier: "FedEx International", origin: "Dallas, TX, US", destination: "Mumbai, IN", eta: "2026-08-15", status: "in_transit" as ShipmentStatus, weight: "12.7 kg" },
  { id: "SHP-2024-003", tracking: "UPS-1Z999AA10123456784", order: "SO-2024-003", carrier: "UPS Worldwide", origin: "Amsterdam, NL", destination: "Chennai, IN", eta: "2026-08-18", status: "customs" as ShipmentStatus, weight: "2.1 kg" },
  { id: "SHP-2024-004", tracking: "ARAMEX-5532914882", order: "SO-2024-004", carrier: "Aramex Priority", origin: "Dubai, AE", destination: "Delhi, IN", eta: "2026-08-22", status: "processing" as ShipmentStatus, weight: "8.9 kg" },
  { id: "SHP-2024-005", tracking: "DHL-7842391099", order: "SO-2024-005", carrier: "DHL Express", origin: "Munich, DE", destination: "Hyderabad, IN", eta: "2026-09-02", status: "in_transit" as ShipmentStatus, weight: "18.3 kg" },
];

const STATUS_TABS = ["All", "processing", "in_transit", "customs", "out_for_delivery", "delivered"];

export default function AdminShipmentsPage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");

  const filtered = useMemo(() =>
    mockShipments.filter((s) => {
      const q = search.toLowerCase();
      const matchQ = !q || s.id.toLowerCase().includes(q) || s.tracking.toLowerCase().includes(q) || s.order.toLowerCase().includes(q) || s.carrier.toLowerCase().includes(q);
      const matchT = tab === "All" || s.status === tab;
      return matchQ && matchT;
    }), [search, tab]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Import & Shipments</h1>
          <p className="font-body-md text-[#44474d]">Track international shipments and customs clearance.</p>
        </div>
        <button className="flex items-center gap-2 border border-[#E4E7EC] bg-white px-4 py-2 rounded font-label-md text-sm text-[#111c2d] hover:bg-[#f0f3ff]">
          <Download size={15} /> Export
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tracking # or carrier..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
        </div>
        <div className="flex flex-wrap gap-1 bg-[#f0f3ff] p-1 rounded-lg">
          {STATUS_TABS.map((s) => (
            <button key={s} onClick={() => setTab(s)} className={`px-3 py-1.5 rounded font-label-sm text-xs whitespace-nowrap transition-colors ${tab === s ? "bg-white text-[#0B1F3A] shadow-sm" : "text-[#44474d] hover:text-[#0B1F3A]"}`}>
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                {["Shipment", "Tracking #", "Order", "Carrier", "Route", "Weight", "ETA", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((s) => {
                const st = SHIPMENT_STATUS[s.status];
                const Icon = st.icon;
                return (
                  <tr key={s.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                    <td className="px-5 py-4 font-mono-label text-[#0B1F3A] font-medium text-sm">{s.id}</td>
                    <td className="px-5 py-4 font-mono-label text-[#44474d] text-xs">{s.tracking}</td>
                    <td className="px-5 py-4 font-mono-label text-[#44474d] text-sm">{s.order}</td>
                    <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{s.carrier}</td>
                    <td className="px-5 py-4">
                      <div className="font-body-sm text-[#111c2d] text-xs">
                        <span>{s.origin}</span>
                        <span className="text-[#44474d] mx-1">→</span>
                        <span>{s.destination}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono-label text-[#44474d] text-sm">{s.weight}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{s.eta}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-xs ${st.color}`}>
                        <Icon size={11} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button className="font-label-sm text-[#1769E0] hover:underline text-xs opacity-0 group-hover:opacity-100 transition-opacity">Track</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="py-12 text-center font-body-md text-[#44474d]">No shipments found</div>}
      </div>
    </div>
  );
}