import Link from "next/link";
import { ArrowRight, Upload, Globe, Package, ShieldCheck, Plane, Truck, ChevronRight } from "lucide-react";
import { HeroSection } from "@/components/home/HeroSection";
import { ManufacturerMarquee } from "@/components/home/ManufacturerMarquee";
import { HomeAnimations } from "@/components/home/HomeAnimations";

const categories = [
  { name: "Microcontrollers", count: "2,400+" },
  { name: "Power Management", count: "1,800+" },
  { name: "Sensors & Transducers", count: "3,200+" },
  { name: "Passive Components", count: "8,500+" },
  { name: "Connectors", count: "4,100+" },
  { name: "Memory & Storage", count: "950+" },
  { name: "RF & Wireless", count: "1,200+" },
  { name: "Optoelectronics", count: "2,700+" },
];

const howItWorks = [
  { step: "01", title: "Submit Your BOM", desc: "Upload your Bill of Materials or search individual parts by MPN." },
  { step: "02", title: "We Source Globally", desc: "Our team sources from verified distributors and OCMs worldwide." },
  { step: "03", title: "Review Your Quote", desc: "Receive a detailed quotation with pricing, lead times, and compliance data." },
  { step: "04", title: "Approve & Track", desc: "Approve the quote, we handle PO, import, customs, and domestic delivery." },
];

const whyCompex = [
  { icon: Globe, title: "Global Sourcing Network", desc: "Direct access to OCMs, authorized distributors, and verified brokers across Asia, Europe, and North America." },
  { icon: ShieldCheck, title: "100% Genuine Parts", desc: "All components are traceable to authentic sources. No counterfeit risk. Full compliance documentation." },
  { icon: Plane, title: "End-to-End Import", desc: "We handle customs documentation, freight forwarding, and import duties so you don't have to." },
  { icon: Truck, title: "India-wide Delivery", desc: "Secure domestic logistics to any city in India. Real-time tracking from origin to your warehouse." },
];

const industries = [
  "Industrial Automation", "Automotive Electronics", "Power & Energy", "Defense & Aerospace",
  "Medical Devices", "Consumer Electronics", "Telecom & Networking", "Railway & Infrastructure",
];

const stats = [
  { value: 15000, suffix: "+", label: "Components Sourced" },
  { value: 40, suffix: "+", label: "Countries Covered" },
  { value: 500, suffix: "+", label: "Enterprise Clients" },
  { value: 98, suffix: "%", label: "On-Time Delivery" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col w-full">
      <HeroSection />

      {/* Stats */}
      <section className="py-14 px-4 md:px-8 bg-white border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map(({ value, suffix, label }) => (
              <div key={label} className="text-center">
                <div
                  data-counter={String(value)}
                  data-suffix={suffix}
                  className="font-display-lg text-[#1769E0] leading-none"
                >
                  {value.toLocaleString()}{suffix}
                </div>
                <p className="font-label-sm text-[#44474d] uppercase tracking-widest mt-2">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="w-full bg-[#f9f9ff] py-8 border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="flex flex-wrap md:flex-nowrap justify-between gap-6 items-center">
            {[
              { icon: Globe, label: "Global Sourcing", sub: "Direct from OCMs" },
              { icon: Package, label: "Bulk Procurement", sub: "Volume pricing" },
              { icon: ShieldCheck, label: "Genuine Parts", sub: "100% Traceable" },
              { icon: Plane, label: "Import Support", sub: "Customs clearance" },
              { icon: Truck, label: "India-wide Delivery", sub: "Secure logistics" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 flex-1 min-w-[160px]"
                data-reveal
                data-delay={String(i * 0.08)}
              >
                <div className="w-11 h-11 rounded-xl bg-[#e8eeff] flex items-center justify-center shrink-0">
                  <item.icon size={20} className="text-[#1769E0]" />
                </div>
                <div>
                  <h4 className="font-label-md text-[#111c2d]">{item.label}</h4>
                  <p className="font-body-sm text-[#44474d]">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12" data-reveal>
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">Browse by Category</h2>
            <p className="font-body-lg text-[#44474d]">Thousands of components across every product family</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat, i) => (
              <Link
                key={cat.name}
                href={`/products?category=${encodeURIComponent(cat.name)}`}
                className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:border-[#1769E0] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                data-reveal
                data-delay={String(Math.floor(i / 4) * 0.1 + (i % 4) * 0.07)}
              >
                <h3 className="font-label-md text-[#111c2d] group-hover:text-[#1769E0] transition-colors">{cat.name}</h3>
                <p className="font-body-sm text-[#44474d] mt-1">{cat.count} parts</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12" data-reveal>
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">How It Works</h2>
            <p className="font-body-lg text-[#44474d]">From requirement to delivery in four steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {howItWorks.map((step, i) => (
              <div key={i} className="relative" data-reveal data-delay={String(i * 0.1)}>
                <div className="w-12 h-12 rounded-xl bg-[#1769E0]/10 flex items-center justify-center mb-4">
                  <span className="font-bold text-[#1769E0] text-sm tracking-wider">{step.step}</span>
                </div>
                <h3 className="font-headline-sm text-[#0B1F3A] mb-2">{step.title}</h3>
                <p className="font-body-md text-[#44474d]">{step.desc}</p>
                {i < howItWorks.length - 1 && (
                  <ChevronRight size={22} className="absolute top-3 -right-4 text-[#E4E7EC] hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOM CTA */}
      <section className="py-16 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div data-reveal>
            <h2 className="font-headline-lg text-white mb-3">Have a Complete BOM?</h2>
            <p className="font-body-lg text-[#7587a7]">Upload your Bill of Materials and get a comprehensive quote for all line items.</p>
          </div>
          <div className="flex gap-4 shrink-0" data-reveal data-delay="0.15">
            <Link href="/request-quote?mode=bom" className="bg-[#1769E0] text-white px-8 py-4 rounded-xl font-label-md font-bold hover:bg-[#1257b8] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2">
              <Upload size={20} /> BOM Enquiry
            </Link>
            <Link href="/request-quote" className="bg-white/10 text-white border border-white/20 px-8 py-4 rounded-xl font-label-md hover:bg-white/20 transition-all duration-300">
              Manual Entry
            </Link>
          </div>
        </div>
      </section>

      {/* Why Compex */}
      <section className="py-20 px-4 md:px-8 bg-white">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12" data-reveal>
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">Why Choose Compex Solution</h2>
            <p className="font-body-lg text-[#44474d]">The preferred sourcing partner for India&apos;s leading manufacturers</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {whyCompex.map((item, i) => (
              <div
                key={i}
                className="flex gap-5 p-7 bg-white rounded-2xl border border-[#E4E7EC] hover:shadow-lg hover:border-[#1769E0]/20 hover:-translate-y-0.5 transition-all duration-300"
                data-reveal
                data-delay={String(i * 0.1)}
              >
                <div className="w-12 h-12 rounded-xl bg-[#e8eeff] flex items-center justify-center shrink-0">
                  <item.icon size={24} className="text-[#1769E0]" />
                </div>
                <div>
                  <h3 className="font-headline-sm text-[#0B1F3A] mb-2">{item.title}</h3>
                  <p className="font-body-md text-[#44474d]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-16 px-4 md:px-8 bg-[#f0f3ff]">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-8 text-center" data-reveal>Industries We Serve</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {industries.map((ind, i) => (
              <Link
                key={ind}
                href="/industries"
                className="bg-white border border-[#E4E7EC] text-[#0B1F3A] px-5 py-2.5 rounded-full font-label-md hover:bg-[#0B1F3A] hover:text-white hover:border-[#0B1F3A] hover:-translate-y-0.5 transition-all duration-300"
                data-reveal
                data-delay={String(i * 0.05)}
              >
                {ind}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ManufacturerMarquee />

      {/* Final CTA */}
      <section className="py-24 px-4 md:px-8 bg-gradient-to-br from-[#1769E0] to-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-display-lg text-white mb-4" data-reveal>
            Ready to Streamline Your Procurement?
          </h2>
          <p className="font-body-lg text-white/80 mb-10 max-w-2xl mx-auto" data-reveal data-delay="0.1">
            Join hundreds of Indian manufacturers who trust Compex Solution for their electronic component sourcing needs.
          </p>
          <div className="flex flex-wrap justify-center gap-4" data-reveal data-delay="0.2">
            <Link
              href="/request-quote"
              className="group bg-white text-[#1769E0] px-8 py-4 rounded-xl font-label-md font-bold hover:bg-[#f0f3ff] transition-all duration-300 flex items-center gap-2 hover:-translate-y-0.5 shadow-md"
            >
              Request a Quote
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
            <Link href="/login" className="bg-white/10 text-white border border-white/30 px-8 py-4 rounded-xl font-label-md hover:bg-white/20 transition-all duration-300">
              Customer Login
            </Link>
          </div>
        </div>
      </section>

      <HomeAnimations />
    </div>
  );
}
