"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload, Search } from "lucide-react";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";

// Static fallback labels — used only when the real category taxonomy hasn't
// loaded (or is empty). These are existing COMPEX category concepts, not
// invented data; no counts or numbers are attached to them.
const FALLBACK_CATEGORIES = ["Semiconductors", "Connectors", "Integrated Circuits", "Passives", "Sensors", "Power"];

export function HeroSection() {
  const router = useRouter();
  const [mpn, setMpn] = useState("");
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = mpn.trim().toUpperCase();
    if (normalized) router.push(`/products/${encodeURIComponent(normalized)}`);
  };

  const categoryCues =
    categories.length > 0
      ? categories.slice(0, 6).map((cat) => ({ label: cat.name, href: `/products?categoryId=${encodeURIComponent(cat.id)}` }))
      : FALLBACK_CATEGORIES.map((label) => ({ label, href: undefined as string | undefined }));

  return (
    <section className="w-full border-b border-[#E4E7EC] bg-[#F7F9FC]">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] xl:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 items-center">
        <div>
          <p className="font-mono-label text-[#1769E0] uppercase tracking-wider text-xs mb-4">Industrial electronic component sourcing</p>

          <h1 className="font-display-lg text-[#0B1F3A] leading-[1.05] mb-3 tracking-tight">COMPEX SOLUTION</h1>

          <h2 className="font-headline-lg text-[#0B1F3A] mb-5">
            Search any electronic component.
            <br />
            COMPEX sources it for you.
          </h2>

          <p className="font-body-lg text-[#44474d] mb-8 max-w-xl">
            Search exact manufacturer part numbers to identify electronic components, then submit your requirement and let COMPEX handle sourcing and verification.
          </p>

          <form onSubmit={submitSearch} className="w-full max-w-xl flex items-stretch gap-0 border-2 border-[#0B1F3A]/15 rounded overflow-hidden bg-white focus-within:border-[#1769E0]">
            <div className="flex-1 flex items-center px-4 gap-3">
              <Search size={20} className="text-[#75777e] shrink-0" />
              <input
                id="hero-mpn-search"
                name="q"
                aria-label="Search components by exact MPN or part number"
                className="w-full bg-transparent border-none outline-none py-5 font-mono-label text-[16px] text-[#111c2d] placeholder:text-[#75777e] placeholder:font-body-md"
                placeholder="e.g. STM32F103C8T6"
                value={mpn}
                onChange={(event) => setMpn(event.target.value)}
              />
            </div>
            <button type="submit" className="bg-[#0B1F3A] hover:bg-[#1769E0] text-white px-7 font-label-md transition-colors flex items-center gap-2 whitespace-nowrap">
              Search <ArrowRight size={16} />
            </button>
          </form>

          <p className="font-body-sm text-[#44474d] mt-3">Search by exact manufacturer part number.</p>

          <div className="flex flex-wrap gap-2 mt-8">
            {categoryCues.map((cue) =>
              cue.href ? (
                <Link key={cue.label} href={cue.href} className="tag hover:border-[#1769E0] hover:text-[#1769E0]">
                  {cue.label}
                </Link>
              ) : (
                <span key={cue.label} className="tag">
                  {cue.label}
                </span>
              ),
            )}
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

        <div className="relative w-full h-[220px] sm:h-[280px] lg:h-full self-stretch overflow-hidden lg:-mr-4 xl:-mr-8">
          <Image
            src="/images/hero/electronics-components-hero-transparent.png"
            alt="Electronic components including ICs, semiconductor packages, connectors, and passive components"
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-right hero-visual-animated"
          />
        </div>
      </div>
    </section>
  );
}
