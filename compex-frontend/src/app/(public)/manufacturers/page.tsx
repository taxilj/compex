import type { Metadata } from "next";
import Link from "next/link";
import CTABanner from "@/components/ui/CTABanner";
import ManufacturersGrid from "./ManufacturersGrid";

export const metadata: Metadata = {
  title: "Electronic Component Manufacturers | Compex Solution",
  description: "Browse manufacturers represented in the Compex Solution component catalogue.",
};

export default function ManufacturersPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <nav className="flex items-center gap-2 font-label-sm text-[#7587a7] text-xs mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link><span>/</span>
            <span className="text-white">Manufacturers</span>
          </nav>
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Manufacturers</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Manufacturer Catalogue
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Browse manufacturers represented in our component catalogue, or search an exact part number to check live availability.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <ManufacturersGrid />
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-4">Looking for a specific manufacturer?</h2>
          <p className="font-body-lg text-[#44474d] mb-8 max-w-2xl mx-auto">
            Search an exact MPN and we&apos;ll check live availability across our sourcing network, or submit your requirement directly.
          </p>
          <Link
            href="/request-quote"
            className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors"
          >
            Submit Your Requirement
          </Link>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
