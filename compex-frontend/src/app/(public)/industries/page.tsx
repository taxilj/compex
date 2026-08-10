import type { Metadata } from "next";
import { Factory, Cpu, Zap, Shield, Heart, Radio, Train, Wifi, Car } from "lucide-react";
import Link from "next/link";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Electronic Component Sourcing by Industry | Compex Solution",
  description: "Compex Solution sources electronic components for industrial automation, automotive, medical, telecom, defense, and more industries across India.",
};

const industries = [
  { icon: Car, name: "Automotive Electronics", desc: "Sourcing ICs, sensors, and power components for automotive-grade applications." },
  { icon: Factory, name: "Industrial Automation", desc: "PLCs, drives, motion controllers, and embedded modules for manufacturing lines." },
  { icon: Zap, name: "Power & Energy", desc: "Power semiconductors, MOSFETs, IGBTs, and magnetic components for energy systems." },
  { icon: Shield, name: "Defense & Aerospace", desc: "High-reliability components with full traceability for mission-critical applications." },
  { icon: Heart, name: "Medical Devices", desc: "Precision ICs, sensors, and passive components for medical equipment." },
  { icon: Cpu, name: "Consumer Electronics", desc: "Microcontrollers, display drivers, and connectivity modules at volume." },
  { icon: Radio, name: "Telecom & Networking", desc: "RF components, transceivers, and switching ICs for communication infrastructure." },
  { icon: Train, name: "Railway & Infrastructure", desc: "Ruggedized components for rail signaling, control, and power systems." },
  { icon: Wifi, name: "IoT & Embedded Systems", desc: "Wireless modules, microcontrollers, and sensors for connected product development." },
];

export default function IndustriesPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Industries</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Electronic Component Sourcing for Every Industry
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Compex Solution works with design engineers and procurement teams across manufacturing sectors to source the right components — on time and at the right price.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((ind) => (
              <div key={ind.name} className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:border-[#1769E0] hover:shadow-md transition-all group">
                <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center mb-4">
                  <ind.icon size={24} className="text-[#1769E0]" />
                </div>
                <h2 className="font-headline-sm text-[#0B1F3A] mb-2 group-hover:text-[#1769E0] transition-colors">{ind.name}</h2>
                <p className="font-body-md text-[#44474d]">{ind.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-4">Sourcing for Your Sector</h2>
          <p className="font-body-lg text-[#44474d] mb-8 max-w-2xl mx-auto">
            Have a specific component requirement? Our team handles sourcing across hundreds of manufacturers and distributors globally.
          </p>
          <Link
            href="/request-quote"
            className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors"
          >
            Request a Quote
          </Link>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}