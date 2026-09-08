"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Upload, Globe, ShieldCheck, Plane, Truck } from "lucide-react";
import { HeroSection } from "@/components/home/HeroSection";
import { FeaturedProducts } from "@/components/home/FeaturedProducts";
import { ManufacturerMarquee } from "@/components/home/ManufacturerMarquee";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";

const howItWorks = [
  { step: "01", title: "Submit your requirement", desc: "Search an exact MPN, or upload your Bill of Materials for multiple line items." },
  { step: "02", title: "We source globally", desc: "Our team sources from verified distributors and OCMs worldwide, verifying manufacturer identity." },
  { step: "03", title: "Review your quote", desc: "Receive a detailed quotation with pricing, lead times, and compliance data." },
  { step: "04", title: "Approve & track", desc: "Approve the quote — we handle the purchase order, import, customs, and domestic delivery." },
];

const capabilities = [
  { icon: Globe, title: "Global sourcing network", desc: "Direct access to OCMs, authorized distributors, and verified brokers across Asia, Europe, and North America." },
  { icon: ShieldCheck, title: "Genuine, traceable parts", desc: "Components are traceable to authentic sources, with full compliance documentation on request." },
  { icon: Plane, title: "End-to-end import handling", desc: "We manage customs documentation, freight forwarding, and import duties." },
  { icon: Truck, title: "India-wide delivery", desc: "Secure domestic logistics to any city in India, with tracking from origin to warehouse." },
];

const industries = [
  "Industrial Automation", "Automotive Electronics", "Power & Energy", "Defense & Aerospace",
  "Medical Devices", "Consumer Electronics", "Telecom & Networking", "Railway & Infrastructure",
];

export default function HomePage() {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col w-full">
      <HeroSection />

      <FeaturedProducts />

      {/* Categories — real taxonomy, no invented counts */}
      {categories.length > 0 && (
        <section className="py-16 px-4 md:px-8 border-b border-[#E4E7EC]">
          <div className="max-w-[1280px] mx-auto">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="font-headline-lg text-[#0B1F3A]">Browse by Category</h2>
              <Link href="/products" className="font-label-md text-[#1769E0] hover:underline whitespace-nowrap">View all →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#E4E7EC] border border-[#E4E7EC]">
              {categories.slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?categoryId=${encodeURIComponent(cat.id)}`}
                  className="bg-white p-5 hover:bg-[#f0f3ff] transition-colors group"
                >
                  <h3 className="font-label-md text-[#111c2d] group-hover:text-[#1769E0]">{cat.name}</h3>
                  {cat.children.length > 0 && (
                    <p className="font-body-sm text-[#44474d] mt-1">{cat.children.length} subcategories</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="py-16 px-4 md:px-8 bg-[#f9f9ff] border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-10 max-w-xl">From requirement to delivery, in four steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-10">
            {howItWorks.map((step) => (
              <div key={step.step} className="border-t-2 border-[#0B1F3A] pt-4">
                <span className="font-mono-label text-[#1769E0]">{step.step}</span>
                <h3 className="font-headline-sm text-[#0B1F3A] mt-2 mb-2">{step.title}</h3>
                <p className="font-body-sm text-[#44474d]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOM CTA */}
      <section className="py-14 px-4 md:px-8 border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-headline-md text-[#0B1F3A] mb-1.5">Have a complete BOM?</h2>
            <p className="font-body-md text-[#44474d]">Upload your Bill of Materials and get a comprehensive quote for all line items.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/request-quote?mode=bom" className="bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors flex items-center gap-2">
              <Upload size={16} /> BOM Enquiry
            </Link>
            <Link href="/request-quote" className="border border-[#0B1F3A] text-[#0B1F3A] px-6 py-3 rounded font-label-md hover:bg-[#0B1F3A] hover:text-white transition-colors">
              Manual Entry
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities (merged trust-strip + why-compex — was duplicated content) */}
      <section className="py-16 px-4 md:px-8 bg-white border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-10 max-w-xl">Why manufacturers source through Compex</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
            {capabilities.map((item) => (
              <div key={item.title} className="flex gap-4">
                <item.icon size={20} className="text-[#1769E0] shrink-0 mt-1" />
                <div>
                  <h3 className="font-label-md text-[#0B1F3A] mb-1.5">{item.title}</h3>
                  <p className="font-body-sm text-[#44474d]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-14 px-4 md:px-8 bg-[#f9f9ff] border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-headline-md text-[#0B1F3A] mb-6">Industries we serve</h2>
          <div className="flex flex-wrap gap-2">
            {industries.map((ind) => (
              <Link key={ind} href="/industries" className="tag hover:border-[#1769E0] hover:text-[#1769E0]">
                {ind}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <ManufacturerMarquee />

      {/* Final CTA — solid ink, no gradient */}
      <section className="py-16 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <h2 className="font-headline-lg text-white max-w-lg">Ready to source your next component?</h2>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link href="/request-quote" className="bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors flex items-center gap-2">
              Request a Quote
              <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="border border-white/30 text-white px-6 py-3 rounded font-label-md hover:bg-white/10 transition-colors">
              Customer Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
