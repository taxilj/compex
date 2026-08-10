import type { Metadata } from "next";
import { Package, Globe, Search, AlertTriangle, TrendingDown, Plane, Truck, FileText } from "lucide-react";
import Link from "next/link";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Electronic Component Sourcing Services | Compex Solution",
  description: "B2B sourcing services: BOM procurement, global supplier sourcing, obsolete components, import management, and India-wide delivery.",
};

const services = [
  { icon: Package, title: "Electronic Component Sourcing", desc: "We source standard and specialist electronic components from global manufacturers and authorized distributors." },
  { icon: FileText, title: "BOM Procurement", desc: "Upload your Bill of Materials and receive a consolidated procurement quote for all line items." },
  { icon: Globe, title: "Global Supplier Sourcing", desc: "Access to a broad network of component suppliers across Asia, Europe, and North America." },
  { icon: AlertTriangle, title: "Obsolete & Hard-to-Find", desc: "We specialize in sourcing discontinued, end-of-life, and long lead-time components through specialist channels." },
  { icon: TrendingDown, title: "Cost Optimization", desc: "We compare multiple supply sources to find the best combination of price, quality, and availability." },
  { icon: Plane, title: "Import Management", desc: "End-to-end handling of international shipments, customs clearance, and import documentation for India." },
  { icon: Truck, title: "Logistics Coordination", desc: "Coordinated logistics from overseas supplier to your facility, including consolidated shipping for multi-source orders." },
  { icon: Search, title: "Part Identification", desc: "We assist in identifying equivalent or substitute components when the original part is unavailable." },
];

export default function ServicesPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Services</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            End-to-End Electronic Component Services
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl mb-8">
            From sourcing a single critical component to managing a complex multi-line BOM, Compex Solution handles procurement, import, and delivery.
          </p>
          <Link
            href="/request-quote"
            className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors"
          >
            Request a Quote
          </Link>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((svc) => (
              <div key={svc.title} className="flex gap-5 p-6 bg-white rounded-xl border border-[#E4E7EC] hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center shrink-0">
                  <svc.icon size={24} className="text-[#1769E0]" />
                </div>
                <div>
                  <h2 className="font-headline-sm text-[#0B1F3A] mb-2">{svc.title}</h2>
                  <p className="font-body-md text-[#44474d]">{svc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}