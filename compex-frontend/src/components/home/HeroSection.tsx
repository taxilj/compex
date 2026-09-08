"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload, Search } from "lucide-react";

const capabilities = ["Exact-MPN matching", "Manufacturer-verified data", "Datasheet-linked", "Global sourcing network"];

export function HeroSection() {
  const router = useRouter();
  const [mpn, setMpn] = useState("");

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = mpn.trim().toUpperCase();
    if (normalized) router.push(`/products/${encodeURIComponent(normalized)}`);
  };

  return (
    <section className="w-full border-b border-[#E4E7EC] bg-[#F7F9FC]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-14 lg:py-20">
        <div className="max-w-2xl">
          <p className="font-mono-label text-[#1769E0] uppercase tracking-wider text-xs mb-4">Industrial electronic component sourcing</p>

          <h1 className="font-display-lg text-[#0B1F3A] leading-[1.05] mb-5 max-w-xl">
            Search any component.
            <br />
            Compex sources it for you.
          </h1>

          <p className="font-body-lg text-[#44474d] max-w-xl mb-8">
            Enter an exact manufacturer part number to identify the component, then submit your requirement — we handle sourcing, verification, and delivery.
          </p>

          <form onSubmit={submitSearch} className="w-full max-w-xl flex items-stretch gap-0 border border-[#0B1F3A]/20 rounded overflow-hidden bg-white focus-within:border-[#1769E0]">
            <div className="flex-1 flex items-center px-4 gap-3">
              <Search size={18} className="text-[#75777e] shrink-0" />
              <input
                name="q"
                aria-label="Search components by exact MPN or part number"
                className="w-full bg-transparent border-none outline-none py-4 font-mono-label text-[#111c2d] placeholder:text-[#75777e] placeholder:font-body-md"
                placeholder="e.g. STM32F103C8T6"
                value={mpn}
                onChange={(event) => setMpn(event.target.value)}
              />
            </div>
            <button type="submit" className="bg-[#0B1F3A] hover:bg-[#1769E0] text-white px-6 font-label-md transition-colors flex items-center gap-2 whitespace-nowrap">
              Search <ArrowRight size={16} />
            </button>
          </form>

          <p className="font-body-sm text-[#44474d]/70 mt-3">
            Try{" "}
            <Link href="/products/STM32F103C8T6" className="text-[#1769E0] hover:underline font-mono-label">STM32F103C8T6</Link>
            {" — "}exact MPN matches only, no fuzzy substitutions.
          </p>

          <div className="flex flex-wrap gap-2 mt-8">
            {capabilities.map((cap) => (
              <span key={cap} className="tag">{cap}</span>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/request-quote" className="bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors flex items-center gap-2">
              Request a Quote
              <ArrowRight size={16} />
            </Link>
            <Link href="/request-quote?mode=bom" className="border border-[#0B1F3A] text-[#0B1F3A] px-6 py-3 rounded font-label-md hover:bg-[#0B1F3A] hover:text-white transition-colors flex items-center gap-2">
              <Upload size={16} />
              Upload a BOM
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
