import type { Metadata } from "next";
import Image from "next/image";
import { Factory, Cpu, Zap, Shield, Heart, Radio, Train, Wifi, Car } from "lucide-react";
import Link from "next/link";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Electronic Component Sourcing by Industry | Compex Solution",
  description: "Compex Solution sources electronic components for industrial automation, automotive, medical, telecom, defense, and more industries across India.",
};

// Real, owner-provided photography only (compex-frontend/public/images) --
// no per-industry stock photos exist, so the same small set is reused
// across cards rather than inventing or sourcing new imagery.
const industryImages = [
  "/images/hero/pcb-electronic-components.jpg",
  "/images/products/circuit-board-detail.jpg",
  "/images/services/warehouse-operations.jpg",
  "/images/hero/electronics-components-hero-transparent.png",
];

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
].map((industry, index) => ({
  ...industry,
  image: industryImages[index % industryImages.length],
}));

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
            {industries.map((ind, index) => (
              <div key={ind.name} className="bg-white border border-[#E4E7EC] rounded-xl overflow-hidden hover:border-[#1769E0] hover:shadow-md transition-all group">
                <div className="relative w-full aspect-[16/10] bg-[#f0f3ff]">
                  <Image
                    src={ind.image}
                    alt={`${ind.name} electronic components`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    loading={index < 3 ? "eager" : "lazy"}
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A]/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 w-11 h-11 rounded-lg bg-white shadow-sm flex items-center justify-center">
                    <ind.icon size={22} className="text-[#1769E0]" />
                  </div>
                </div>
                <div className="p-6">
                  <h2 className="font-headline-sm text-[#0B1F3A] mb-2 group-hover:text-[#1769E0] transition-colors">{ind.name}</h2>
                  <p className="font-body-md text-[#44474d]">{ind.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-4">Sourcing for Your Sector</h2>
          <p className="font-body-lg text-[#44474d] mb-8 max-w-2xl mx-auto">
            Have a specific component requirement? Our team sources across a verified network of authorized manufacturers and distributors.
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
