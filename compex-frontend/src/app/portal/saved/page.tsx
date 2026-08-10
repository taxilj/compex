"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { products } from "@/data/mock/products";
import { Search, Bookmark, ChevronRight } from "lucide-react";

const INITIAL_SAVED_IDS = ["p1", "p2", "p3"];

export default function SavedProductsPage() {
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>(INITIAL_SAVED_IDS);

  const savedProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          savedIds.includes(p.id) &&
          (query === "" ||
            p.mpn.toLowerCase().includes(query.toLowerCase()) ||
            p.manufacturer.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase()))
      ),
    [savedIds, query]
  );

  const remove = (id: string) => setSavedIds((prev) => prev.filter((s) => s !== id));

  const availClass = (a: string) =>
    a === "available"
      ? "text-[#12B76A]"
      : a === "limited"
      ? "text-[#F79009]"
      : "text-[#44474d]";
  const availLabel = (a: string) =>
    a === "available" ? "Available" : a === "limited" ? "Limited" : "On Request";

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Saved Products</h1>
          <p className="font-body-md text-[#44474d] mt-1">
            {savedProducts.length} saved part{savedProducts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/products"
          className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#1a3357] transition-colors"
        >
          Browse Products <ChevronRight size={16} />
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-[#E4E7EC] p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input
            type="text"
            placeholder="Search saved products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#E4E7EC] rounded font-body-md text-[#111c2d] focus:outline-none focus:border-[#1769E0]"
          />
        </div>
      </div>

      {savedProducts.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E4E7EC] p-16 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#f0f3ff] flex items-center justify-center">
            <Bookmark size={32} className="text-[#1769E0]" />
          </div>
          <div>
            <h2 className="font-headline-sm text-[#111c2d]">No saved products yet</h2>
            <p className="font-body-md text-[#44474d] mt-1">
              Save products while browsing to quickly request quotes later.
            </p>
          </div>
          <Link
            href="/products"
            className="bg-[#1769E0] text-white px-6 py-2.5 rounded font-label-md hover:bg-[#1456c0] transition-colors"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#E4E7EC] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-[#f0f3ff]">
                  {["Part Number", "Manufacturer", "Description", "Package", "Availability", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="py-3 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {savedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#f9f9ff]">
                    <td className="py-3 px-4 font-mono-label text-[#0B1F3A] font-medium">{p.mpn}</td>
                    <td className="py-3 px-4 font-body-sm text-[#111c2d]">{p.manufacturer}</td>
                    <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[220px] truncate">
                      {p.description}
                    </td>
                    <td className="py-3 px-4 font-mono-label text-[#44474d]">{p.package}</td>
                    <td className="py-3 px-4">
                      <span className={`font-label-sm ${availClass(p.availability)}`}>
                        {availLabel(p.availability)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/request-quote?mpn=${encodeURIComponent(p.mpn)}`}
                          className="px-3 py-1.5 bg-[#1769E0] text-white rounded font-label-sm hover:bg-[#1456c0] transition-colors text-sm"
                        >
                          Request Quote
                        </Link>
                        <button
                          onClick={() => remove(p.id)}
                          className="px-3 py-1.5 border border-[#E4E7EC] text-[#44474d] rounded font-label-sm hover:border-[#F04438] hover:text-[#F04438] transition-colors text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}