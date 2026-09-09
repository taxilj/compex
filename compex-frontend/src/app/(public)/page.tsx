"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSpreadsheet, FileText, ListChecks, Calculator } from "lucide-react";
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

const industries = [
  "Industrial Automation", "Automotive Electronics", "Power & Energy", "Defense & Aerospace",
  "Medical Devices", "Consumer Electronics", "Telecom & Networking", "Railway & Infrastructure",
];

const tools = [
  { href: "/tools/bom", icon: FileSpreadsheet, title: "BOM Management" },
  { href: "/tools/rfq", icon: FileText, title: "Request for Quote" },
  { href: "/tools/search-multiple", icon: ListChecks, title: "Search Multiple Parts" },
  { href: "/tools/calculators", icon: Calculator, title: "Engineering Calculators" },
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

      {/* Manufacturers — real catalogue data, hides itself when empty */}
      <ManufacturerMarquee />

      {/* Sourcing Network */}
      <section className="py-16 px-4 md:px-8 border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-headline-md text-[#0B1F3A] mb-1.5">A verified, multi-channel sourcing network</h2>
            <p className="font-body-md text-[#44474d] max-w-xl">
              We source through authorized global distribution channels — not an open marketplace — and manage the full procurement relationship for you.
            </p>
          </div>
          <Link href="/suppliers" className="border border-[#0B1F3A] text-[#0B1F3A] px-6 py-3 rounded font-label-md hover:bg-[#0B1F3A] hover:text-white transition-colors shrink-0 whitespace-nowrap">
            View Sourcing Network
          </Link>
        </div>
      </section>

      {/* Tools */}
      <section className="py-16 px-4 md:px-8 bg-[#f9f9ff] border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="font-headline-lg text-[#0B1F3A]">Engineering & sourcing tools</h2>
            <Link href="/tools" className="font-label-md text-[#1769E0] hover:underline whitespace-nowrap">View all →</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#E4E7EC] border border-[#E4E7EC]">
            {tools.map((tool) => (
              <Link key={tool.href} href={tool.href} className="bg-white p-5 hover:bg-[#f0f3ff] transition-colors group">
                <tool.icon size={20} className="text-[#1769E0] mb-3" />
                <h3 className="font-label-md text-[#111c2d] group-hover:text-[#1769E0]">{tool.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How COMPEX Works */}
      <section className="py-16 px-4 md:px-8 border-b border-[#E4E7EC]">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-10 max-w-xl">How COMPEX Works</h2>
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
