"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { products, manufacturers } from "@/data/mock/products";
import { StatusBadge } from "@/components/ui/StatusBadge";

const categories = ["Microcontrollers", "DSP Controllers", "Power Management", "Gate Drivers", "Sensors"];

function ProductSearchContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);

  const results = useMemo(() => {
    return products.filter((p) => {
      const matchQuery =
        !query ||
        p.mpn.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase()) ||
        p.manufacturer.toLowerCase().includes(query.toLowerCase());
      const matchMfr = selectedManufacturers.length === 0 || selectedManufacturers.includes(p.manufacturer);
      const matchCat = selectedCategories.length === 0 || selectedCategories.includes(p.category);
      const matchAvail = availability.length === 0 || availability.includes(p.availability);
      return matchQuery && matchMfr && matchCat && matchAvail;
    });
  }, [query, selectedManufacturers, selectedCategories, availability]);

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) =>
    arr.includes(val) ? set(arr.filter((x) => x !== val)) : set([...arr, val]);

  return (
    <div className="flex flex-col w-full px-4 md:px-8 py-8 gap-8">
      <section>
        <h1 className="font-headline-lg text-[#111c2d] mb-4">Product Search</h1>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#44474d]" />
            <input
              className="w-full pl-12 pr-4 py-4 rounded bg-white font-body-md text-[#111c2d] border border-[#E4E7EC] focus:outline-none focus:ring-2 focus:ring-[#1769E0] shadow-sm"
              placeholder="Search by MPN, description, or manufacturer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-72 shrink-0 bg-white p-6 rounded shadow-sm border border-[#E4E7EC] lg:sticky lg:top-4 self-start">
          <div className="flex justify-between items-center pb-4 border-b border-[#E4E7EC] mb-4">
            <h2 className="font-headline-sm text-[#111c2d]">Filters</h2>
            <button
              onClick={() => { setSelectedManufacturers([]); setSelectedCategories([]); setAvailability([]); }}
              className="font-label-sm text-[#1769E0] hover:underline uppercase tracking-wider"
            >
              Clear All
            </button>
          </div>
          <FilterGroup label="Category">
            {categories.map((c) => (
              <CheckItem key={c} label={c} checked={selectedCategories.includes(c)} onChange={() => toggle(selectedCategories, c, setSelectedCategories)} />
            ))}
          </FilterGroup>
          <FilterGroup label="Manufacturer">
            {manufacturers.map((m) => (
              <CheckItem key={m.name} label={m.name} checked={selectedManufacturers.includes(m.name)} onChange={() => toggle(selectedManufacturers, m.name, setSelectedManufacturers)} />
            ))}
          </FilterGroup>
          <FilterGroup label="Availability">
            {[
              { value: "available", label: "Available" },
              { value: "on_request", label: "Available on Request" },
              { value: "limited", label: "Limited Stock" },
            ].map((a) => (
              <CheckItem key={a.value} label={a.label} checked={availability.includes(a.value)} onChange={() => toggle(availability, a.value, setAvailability)} />
            ))}
          </FilterGroup>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="font-body-sm text-[#44474d]">
              <span className="font-label-md text-[#111c2d]">{results.length}</span> result{results.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="bg-white rounded shadow-sm border border-[#E4E7EC] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="bg-[#f0f3ff]">
                    {["MPN", "Manufacturer", "Description", "Package", "Lead Time", "MOQ", "Availability", "Action"].map((h) => (
                      <th key={h} className="py-3 px-4 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {results.map((p) => (
                    <tr key={p.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                      <td className="py-3 px-4">
                        <Link href={`/products/${p.mpn}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{p.mpn}</Link>
                      </td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">{p.manufacturer}</td>
                      <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[250px] truncate">{p.description}</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">{p.package}</td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">{p.leadTimeDays}d</td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">{p.moq.toLocaleString()}</td>
                      <td className="py-3 px-4"><StatusBadge status={p.availability} /></td>
                      <td className="py-3 px-4">
                        <Link href={`/request-quote?mpn=${p.mpn}`} className="bg-[#1769E0] text-white px-3 py-1.5 rounded font-label-sm text-xs hover:bg-[#1257b8] transition-colors whitespace-nowrap">
                          Request Quote
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {results.length === 0 && (
              <div className="py-16 text-center">
                <p className="font-body-md text-[#44474d]">No products found. Try a different search term or clear the filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="font-label-md text-[#44474d] uppercase tracking-wider mb-3">{label}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? "bg-[#0B1F3A] border-[#0B1F3A]" : "border-[#c4c6ce] group-hover:border-[#0B1F3A]"}`}
        onClick={onChange}
      >
        {checked && <span className="text-white text-xs">✓</span>}
      </div>
      <span className="font-body-sm text-[#111c2d]">{label}</span>
    </label>
  );
}

export default function ProductSearchPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 font-body-md text-[#44474d]">Loading products...</div>}>
      <ProductSearchContent />
    </Suspense>
  );
}
