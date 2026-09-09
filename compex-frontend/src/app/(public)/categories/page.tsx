"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, Zap, Cable, CircuitBoard, BatteryCharging, Radio, Package, ArrowRight } from "lucide-react";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";
import CTABanner from "@/components/ui/CTABanner";

// Generic, factual blurbs about what a category concept covers electronically —
// not a claim about Compex's catalogue scale. Falls back to a neutral line for
// any real category name not covered here, so new categories from future
// imports render correctly with no further code changes.
const CATEGORY_BLURBS: Record<string, string> = {
  "Integrated Circuits (ICs)": "Semiconductor devices with a complete circuit fabricated on a single chip — microcontrollers, amplifiers, timers, and logic ICs.",
  "Discrete Semiconductor Products": "Individual semiconductor devices — diodes, transistors, and rectifiers — used as single-function building blocks in a circuit.",
  "Connectors": "Interconnect hardware for joining circuits, cables, and boards — headers, terminals, and board-to-board connectors.",
  "Passive Components": "Non-amplifying components — resistors, capacitors, and inductors — that shape, store, or limit electrical signals.",
  "Power": "Voltage regulation, conversion, and protection components for powering a circuit.",
  "Sensors": "Components that detect and respond to physical input — temperature, light, motion, and more.",
};

function categoryIcon(name: string) {
  if (/integrated circuit|\bic\b|microcontroller/i.test(name)) return Cpu;
  if (/discrete|semiconductor|transistor|diode/i.test(name)) return Zap;
  if (/connector|cable|interconnect/i.test(name)) return Cable;
  if (/passive|resistor|capacitor|inductor/i.test(name)) return CircuitBoard;
  if (/power|voltage|battery/i.test(name)) return BatteryCharging;
  if (/sensor|rf|wireless/i.test(name)) return Radio;
  return Package;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithChildren[] | null>(null);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <nav className="flex items-center gap-2 font-label-sm text-[#7587a7] text-xs mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link><span>/</span>
            <span className="text-white">Categories</span>
          </nav>
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Categories</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Browse by Category
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Explore the Compex catalogue by component category, or search an exact part number directly if you already know what you need.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          {categories === null && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading categories">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-[#f0f3ff] animate-pulse" />
              ))}
            </div>
          )}

          {categories !== null && categories.length === 0 && (
            <div className="text-center py-16 border border-dashed border-[#E4E7EC] rounded-xl">
              <p className="font-headline-sm text-[#0B1F3A] mb-2">No categories in the catalogue yet</p>
              <p className="font-body-sm text-[#44474d] mb-6 max-w-md mx-auto">
                Search an exact MPN to check live availability across our sourcing network, or submit your requirement directly.
              </p>
              <Link href="/products" className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors">
                Search a Component
              </Link>
            </div>
          )}

          {categories !== null && categories.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((cat) => {
                const Icon = categoryIcon(cat.name);
                const blurb = cat.description || CATEGORY_BLURBS[cat.name] || `Explore verified ${cat.name} components in the Compex catalogue.`;
                return (
                  <Link
                    key={cat.id}
                    href={`/products?categoryId=${encodeURIComponent(cat.id)}`}
                    className="group bg-white border border-[#E4E7EC] rounded-xl overflow-hidden hover:border-[#1769E0] hover:shadow-md transition-all flex flex-col"
                  >
                    <div className="h-28 bg-[#f0f3ff] border-b border-[#E4E7EC] flex items-center justify-center relative overflow-hidden">
                      <Icon size={40} className="text-[#0B1F3A]/25" strokeWidth={1.25} />
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <h2 className="font-headline-sm text-[#0B1F3A] mb-1.5">{cat.name}</h2>
                      <p className="font-mono-label text-[#1769E0] text-xs uppercase tracking-wider mb-3">
                        {cat._count.products} product{cat._count.products !== 1 ? "s" : ""}
                      </p>
                      <p className="font-body-sm text-[#44474d] mb-5 flex-1">{blurb}</p>
                      {cat.children.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {cat.children.slice(0, 4).map((child) => (
                            <span key={child.id} className="tag">{child.name}</span>
                          ))}
                        </div>
                      )}
                      <span className="font-label-md text-[#1769E0] flex items-center gap-2 group-hover:gap-3 transition-all mt-auto">
                        Browse Products <ArrowRight size={16} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-4">Don&apos;t see the right category?</h2>
          <p className="font-body-lg text-[#44474d] mb-8 max-w-2xl mx-auto">
            Search an exact MPN directly — we check live availability across our sourcing network even for parts not yet in our catalogue.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors"
          >
            Search a Component
          </Link>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
