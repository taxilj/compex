import type { Metadata } from "next";
import { Upload, Globe, Search, Scale, Clock, Plane, Truck, CheckCircle } from "lucide-react";
import Link from "next/link";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Electronic Component Sourcing & Procurement | Compex Solution",
  description: "Global electronic component sourcing, BOM procurement, supplier discovery, and India-wide delivery. Submit your requirement today.",
};

const capabilities = [
  { icon: Globe, title: "Global Sourcing", desc: "Direct access to manufacturers and distributors across North America, Europe, and Asia." },
  { icon: Upload, title: "BOM Sourcing", desc: "Upload your full Bill of Materials — we source every line item and return a consolidated quote." },
  { icon: Search, title: "Supplier Discovery", desc: "We identify and vet multiple supply sources for each component." },
  { icon: Scale, title: "Price Comparison", desc: "Compare pricing across sources to optimize total procurement cost." },
  { icon: Clock, title: "Lead-Time Management", desc: "We monitor availability and expedite sourcing for components with extended lead times." },
  { icon: Plane, title: "Import Management", desc: "Customs clearance, import duties, and documentation handled end to end." },
  { icon: Truck, title: "India-wide Delivery", desc: "Secure logistics from port to your facility anywhere in India." },
  { icon: CheckCircle, title: "Traceability", desc: "Full traceability documentation for every component batch." },
];

const steps = [
  { step: "01", title: "Requirement", desc: "Share your part numbers, quantities, and delivery timeline." },
  { step: "02", title: "Source", desc: "We identify available stock across global suppliers." },
  { step: "03", title: "Compare", desc: "We evaluate pricing, lead time, and authenticity." },
  { step: "04", title: "Procure", desc: "Order placed with the selected supplier." },
  { step: "05", title: "Import", desc: "Goods cleared through customs and verified on arrival." },
  { step: "06", title: "Deliver", desc: "Secure delivery to your facility across India." },
];

export default function SourcingPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Sourcing</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Global Component Sourcing, Delivered to India
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl mb-8">
            From single components to complete BOMs, Compex Solution manages the full procurement chain — sourcing, customs, and last-mile delivery.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/request-quote"
              className="bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors"
            >
              Request a Quote
            </Link>
            <button className="bg-white/10 text-white border border-white/20 px-8 py-4 rounded-lg font-label-md hover:bg-white/20 transition-colors flex items-center gap-2">
              <Upload size={20} /> Upload BOM
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">The Sourcing Process</h2>
            <p className="font-body-lg text-[#44474d]">From your requirement to your door in six steps</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-[#d6e3ff] font-display-lg mb-2">{s.step}</div>
                <h3 className="font-headline-sm text-[#0B1F3A] mb-1">{s.title}</h3>
                <p className="font-body-sm text-[#44474d]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">Sourcing Capabilities</h2>
            <p className="font-body-lg text-[#44474d]">Everything you need to procure electronic components</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {capabilities.map((cap) => (
              <div key={cap.title} className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-[#e8eeff] flex items-center justify-center mb-4">
                  <cap.icon size={20} className="text-[#1769E0]" />
                </div>
                <h3 className="font-label-md text-[#0B1F3A] mb-2">{cap.title}</h3>
                <p className="font-body-sm text-[#44474d]">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}