import Link from "next/link";
import { ArrowRight, Upload, Globe, Package, ShieldCheck, Plane, Truck, ChevronRight, Search } from "lucide-react";

const categories = [
  { name: "Microcontrollers", icon: "cpu", count: "2,400+" },
  { name: "Power Management", icon: "zap", count: "1,800+" },
  { name: "Sensors & Transducers", icon: "activity", count: "3,200+" },
  { name: "Passive Components", icon: "radio", count: "8,500+" },
  { name: "Connectors", icon: "link", count: "4,100+" },
  { name: "Memory & Storage", icon: "database", count: "950+" },
  { name: "RF & Wireless", icon: "wifi", count: "1,200+" },
  { name: "Optoelectronics", icon: "sun", count: "2,700+" },
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
  "Industrial Automation",
  "Automotive Electronics",
  "Power & Energy",
  "Defense & Aerospace",
  "Medical Devices",
  "Consumer Electronics",
  "Telecom & Networking",
  "Railway & Infrastructure",
];

const manufacturers = ["STMicroelectronics", "Texas Instruments", "NXP Semiconductors", "Infineon", "Microchip", "Renesas", "Nordic Semi", "Qualcomm"];

export default function HomePage() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative w-full pt-16 pb-24 lg:pt-24 lg:pb-32 px-4 md:px-8 overflow-hidden bg-[#f9f9ff]">
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <svg className="absolute w-[800px] h-[800px] -top-48 -right-48 text-[#d6e3ff]" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path d="M42.7,-73.4C55.9,-67.8,67.6,-57.9,76.5,-45.6C85.4,-33.3,91.5,-18.6,89.6,-4.5C87.7,9.6,77.8,23.1,68.2,35.4C58.6,47.7,49.3,58.8,37.3,66.6C25.3,74.4,10.6,78.9,-3.8,77.5C-18.2,76.1,-32.3,68.8,-45.1,60.2C-57.9,51.6,-69.4,41.7,-76.3,29C-83.2,16.3,-85.5,0.8,-83.4,-14C-81.3,-28.8,-74.8,-42.9,-64.3,-53.4C-53.8,-63.9,-39.3,-70.8,-25.6,-74.4C-11.9,-78,2.7,-78.3,16.4,-77.3C30.1,-76.3,44.9,-74,42.7,-73.4Z" fill="currentColor" transform="translate(100 100)" />
          </svg>
        </div>
        <div className="max-w-[1280px] mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <p className="font-mono-label text-[#1769E0] uppercase tracking-widest flex items-center gap-2">
                <span className="w-8 h-px bg-[#1769E0]" /> Enterprise Procurement
              </p>
              <h1 className="font-display-lg text-[#0B1F3A] leading-tight">
                Global Electronic Component Sourcing.{" "}
                <span className="text-[#1769E0]">Delivered Across India.</span>
              </h1>
              <p className="font-body-lg text-[#44474d] max-w-2xl">
                Streamline your supply chain with direct access to global manufacturers and authorized distributors. We handle bulk procurement, customs clearance, and secure domestic delivery for complex BOMs.
              </p>
            </div>

            {/* Search bar */}
            <form action="/products" method="GET" className="w-full max-w-3xl bg-white p-2 rounded-xl shadow-md border border-[#E4E7EC] flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center px-4 py-3 gap-3">
                <Search size={20} className="text-[#75777e] shrink-0" />
                <input
                  name="q"
                  className="w-full bg-transparent border-none outline-none font-body-md text-[#111c2d] placeholder:text-[#75777e]"
                  placeholder="Search by Part Number, MPN or Manufacturer..."
                  type="text"
                />
              </div>
              <button
                type="submit"
                className="bg-[#0B1F3A] hover:bg-[#0B1F3A]/90 text-white px-8 py-4 rounded-lg font-label-md transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                Search Components <ArrowRight size={18} />
              </button>
            </form>

            <p className="font-body-sm text-[#44474d]/70">
              Example:{" "}
              <Link href="/products/STM32F103C8T6" className="text-[#1769E0] hover:underline font-mono-label ml-1">STM32F103C8T6</Link>
              ,{" "}
              <Link href="/products?q=Texas+Instruments" className="text-[#1769E0] hover:underline font-mono-label ml-1">Texas Instruments</Link>
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                href="/request-quote"
                className="bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold uppercase tracking-wide hover:bg-[#1257b8] transition-all flex items-center gap-2 shadow-md"
              >
                Request a Quote
              </Link>
              <button className="bg-white border-2 border-[#0B1F3A] text-[#0B1F3A] px-8 py-4 rounded-lg font-label-md font-bold uppercase tracking-wide hover:bg-[#f0f3ff] transition-all flex items-center gap-2">
                <Upload size={20} /> Upload BOM
              </button>
            </div>
          </div>

          {/* Hero visual */}
          <div className="lg:col-span-5 relative hidden lg:block">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-xl border border-[#E4E7EC] bg-gradient-to-br from-[#0B1F3A] to-[#1769E0]">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white space-y-4 p-8">
                  <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
                    <Package size={40} className="text-white" />
                  </div>
                  <p className="font-headline-md text-white">15,000+ Components</p>
                  <p className="font-body-md text-white/70">Sourced across 40+ countries</p>
                </div>
              </div>
              {/* Floating cards */}
              <div className="absolute top-8 -left-6 bg-white p-4 rounded-xl shadow-lg border border-[#E4E7EC] flex items-center gap-3 z-20">
                <div className="w-10 h-10 rounded-full bg-[#12B76A]/10 flex items-center justify-center">
                  <ShieldCheck size={20} className="text-[#12B76A]" />
                </div>
                <div>
                  <p className="font-label-sm text-[#44474d] uppercase">Sourcing Status</p>
                  <p className="font-label-md text-[#111c2d]">15,000 Units Secured</p>
                </div>
              </div>
              <div className="absolute bottom-12 -right-6 bg-white p-4 rounded-xl shadow-lg border border-[#E4E7EC] flex items-center gap-3 z-20">
                <div className="w-10 h-10 rounded-full bg-[#1769E0]/10 flex items-center justify-center">
                  <Truck size={20} className="text-[#1769E0]" />
                </div>
                <div>
                  <p className="font-label-sm text-[#44474d] uppercase">Delivery Estimate</p>
                  <p className="font-label-md text-[#111c2d]">Arriving Bangalore in 4 Days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="w-full bg-white py-8 border-y border-[#E4E7EC] shadow-sm -mt-8 relative z-20">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8">
          <div className="flex flex-wrap md:flex-nowrap justify-between gap-6 items-center">
            {[
              { icon: Globe, label: "Global Sourcing", sub: "Direct from OCMs" },
              { icon: Package, label: "Bulk Procurement", sub: "Volume pricing" },
              { icon: ShieldCheck, label: "Genuine Parts", sub: "100% Traceable" },
              { icon: Plane, label: "Import Support", sub: "Customs clearance" },
              { icon: Truck, label: "India-wide Delivery", sub: "Secure logistics" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 flex-1 min-w-[180px]">
                <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center shrink-0">
                  <item.icon size={22} className="text-[#1769E0]" />
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

      {/* Product Categories */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">Browse by Category</h2>
            <p className="font-body-lg text-[#44474d]">Thousands of components across every product family</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={`/products?category=${encodeURIComponent(cat.name)}`}
                className="bg-white border border-[#E4E7EC] rounded-lg p-6 hover:border-[#1769E0] hover:shadow-md transition-all group"
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
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">How It Works</h2>
            <p className="font-body-lg text-[#44474d]">From requirement to delivery in four steps</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {howItWorks.map((step, i) => (
              <div key={i} className="relative">
                <div className="text-[#d6e3ff] font-display-lg mb-4">{step.step}</div>
                <h3 className="font-headline-sm text-[#0B1F3A] mb-2">{step.title}</h3>
                <p className="font-body-md text-[#44474d]">{step.desc}</p>
                {i < howItWorks.length - 1 && (
                  <ChevronRight size={24} className="absolute top-8 -right-4 text-[#E4E7EC] hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOM Sourcing CTA */}
      <section className="py-16 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="font-headline-lg text-white mb-3">Have a Complete BOM?</h2>
            <p className="font-body-lg text-[#7587a7]">Upload your Bill of Materials and get a comprehensive quote for all line items.</p>
          </div>
          <div className="flex gap-4 shrink-0">
            <button className="bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors flex items-center gap-2">
              <Upload size={20} /> Upload BOM
            </button>
            <Link href="/request-quote" className="bg-white/10 text-white border border-white/20 px-8 py-4 rounded-lg font-label-md hover:bg-white/20 transition-colors">
              Manual Entry
            </Link>
          </div>
        </div>
      </section>

      {/* Why Compex */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">Why Choose Compex Solution</h2>
            <p className="font-body-lg text-[#44474d]">The preferred sourcing partner for India&apos;s leading manufacturers</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {whyCompex.map((item, i) => (
              <div key={i} className="flex gap-5 p-6 bg-white rounded-lg border border-[#E4E7EC] hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center shrink-0">
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
          <h2 className="font-headline-lg text-[#0B1F3A] mb-8 text-center">Industries We Serve</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {industries.map((ind) => (
              <Link
                key={ind}
                href="/industries"
                className="bg-white border border-[#E4E7EC] text-[#0B1F3A] px-5 py-2.5 rounded-full font-label-md hover:bg-[#0B1F3A] hover:text-white hover:border-[#0B1F3A] transition-all"
              >
                {ind}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Manufacturers */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-3 text-center">Sourcing from Global Leaders</h2>
          <p className="font-body-md text-[#44474d] mb-10 text-center">We source from the world&apos;s top semiconductor manufacturers and authorized distributors.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {manufacturers.map((mfr) => (
              <div key={mfr} className="bg-white border border-[#E4E7EC] rounded-lg p-6 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-lg bg-[#e8eeff] mx-auto mb-3 flex items-center justify-center">
                  <span className="font-bold text-[#0B1F3A] text-sm">{mfr.substring(0, 2)}</span>
                </div>
                <p className="font-label-md text-[#111c2d] text-sm">{mfr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 md:px-8 bg-[#1769E0]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-display-lg text-white mb-4">Ready to Streamline Your Procurement?</h2>
          <p className="font-body-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Join hundreds of Indian manufacturers who trust Compex Solution for their electronic component sourcing needs.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/request-quote"
              className="bg-white text-[#1769E0] px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#f0f3ff] transition-colors flex items-center gap-2"
            >
              Request a Quote <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="bg-white/10 text-white border border-white/30 px-8 py-4 rounded-lg font-label-md hover:bg-white/20 transition-colors">
              Customer Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
