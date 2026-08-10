import type { Metadata } from "next";
import { Globe, Package, ShieldCheck, Truck, Users, Target } from "lucide-react";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "About Compex Solution | Electronic Component Sourcing India",
  description: "Compex Solution is an electronic component sourcing and procurement company helping Indian manufacturers procure components from global suppliers.",
};

const capabilities = [
  { icon: Globe, title: "Global Sourcing", desc: "We source from manufacturers and distributors across North America, Europe, and Asia." },
  { icon: Package, title: "BOM Procurement", desc: "Complete Bill of Materials sourcing and consolidated supply for manufacturing customers." },
  { icon: ShieldCheck, title: "Traceability", desc: "Component traceability documentation for quality-critical applications." },
  { icon: Truck, title: "India-wide Delivery", desc: "Logistics and delivery to any location across India." },
  { icon: Users, title: "Dedicated Support", desc: "Direct communication with our sourcing team throughout the procurement process." },
  { icon: Target, title: "Specialist Sourcing", desc: "Obsolete, hard-to-find, and long lead-time component procurement." },
];

const process = [
  { step: "01", title: "Receive Requirement", desc: "Customer shares part numbers, quantities, and delivery requirements." },
  { step: "02", title: "Source & Quote", desc: "We identify the best available sources and prepare a detailed quote." },
  { step: "03", title: "Procurement", desc: "On approval, we place orders and manage the supply chain." },
  { step: "04", title: "Import & Deliver", desc: "We handle customs clearance and deliver to your facility." },
];

export default function AboutPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">About</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">About Compex Solution</h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Compex Solution is an electronic component sourcing and procurement company based in India. We help manufacturers and design teams procure electronic components from global suppliers with full traceability and India-wide delivery.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="font-headline-lg text-[#0B1F3A] mb-6">What We Do</h2>
              <p className="font-body-lg text-[#44474d] mb-4">
                Compex Solution specializes in sourcing electronic components for Indian manufacturers. We handle the complexities of international procurement — from identifying the right suppliers to managing customs clearance and final delivery.
              </p>
              <p className="font-body-lg text-[#44474d] mb-4">
                Our focus is on serving procurement teams and design engineers who need reliable access to components from global semiconductor manufacturers.
              </p>
              <p className="font-body-lg text-[#44474d]">
                Whether you need a single critical component or a complete Bill of Materials, we manage the sourcing process end to end.
              </p>
            </div>
            <div>
              <h2 className="font-headline-lg text-[#0B1F3A] mb-6">Our Procurement Process</h2>
              <div className="space-y-4">
                {process.map((p) => (
                  <div key={p.step} className="flex gap-4 p-4 bg-[#f9f9ff] rounded-lg">
                    <span className="font-display-lg text-[#d6e3ff] shrink-0">{p.step}</span>
                    <div>
                      <h3 className="font-label-md text-[#0B1F3A] mb-1">{p.title}</h3>
                      <p className="font-body-sm text-[#44474d]">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">Capabilities</h2>
            <p className="font-body-lg text-[#44474d]">What Compex Solution offers to manufacturing customers</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div key={cap.title} className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-[#e8eeff] flex items-center justify-center mb-4">
                  <cap.icon size={20} className="text-[#1769E0]" />
                </div>
                <h3 className="font-headline-sm text-[#0B1F3A] mb-2">{cap.title}</h3>
                <p className="font-body-md text-[#44474d]">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}