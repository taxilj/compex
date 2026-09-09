"use client";

import { useState } from "react";
import Link from "next/link";
import { ListChecks, Loader2 } from "lucide-react";
import { lookupPublicProduct, type PublicProduct } from "@/lib/api/products";
import CTABanner from "@/components/ui/CTABanner";

const MAX_MPNS = 25;

interface RowResult {
  mpn: string;
  status: "pending" | "found" | "not_found" | "error";
  product?: PublicProduct;
}

export default function SearchMultiplePage() {
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<RowResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const mpns = Array.from(
    new Set(
      input
        .split("\n")
        .map((line) => line.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, MAX_MPNS);

  async function runSearch() {
    if (mpns.length === 0) return;
    setIsRunning(true);
    setRows(mpns.map((mpn) => ({ mpn, status: "pending" })));

    for (const mpn of mpns) {
      try {
        const result = await lookupPublicProduct(mpn);
        setRows((prev) =>
          prev.map((row) =>
            row.mpn === mpn
              ? { mpn, status: result.product ? "found" : "not_found", product: result.product ?? undefined }
              : row
          )
        );
      } catch {
        setRows((prev) => (prev.map((row) => (row.mpn === mpn ? { mpn, status: "error" } : row))));
      }
    }
    setIsRunning(false);
  }

  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Tools · Multi-Part Search</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Search Multiple Parts
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Paste up to {MAX_MPNS} exact manufacturer part numbers, one per line. Each is checked live against
            our sourcing network using the same exact-MPN search as the header.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
          <div>
            <label htmlFor="mpn-list" className="font-label-md text-[#0B1F3A] block mb-2">
              MPN list (one per line)
            </label>
            <textarea
              id="mpn-list"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={12}
              placeholder={"STM32F103C8T6\nLM358DR\nNE555P"}
              className="w-full border border-[#E4E7EC] rounded-lg p-3 font-mono-label text-[#111c2d] focus:outline-none focus:border-[#1769E0] focus:ring-1 focus:ring-[#1769E0]"
            />
            <div className="flex items-center justify-between mt-2 mb-4">
              <span className="font-body-sm text-[#75777e]">{mpns.length} / {MAX_MPNS} parts</span>
            </div>
            <button
              type="button"
              onClick={runSearch}
              disabled={mpns.length === 0 || isRunning}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <ListChecks size={16} />}
              {isRunning ? "Searching…" : "Search Parts"}
            </button>
          </div>

          <div>
            {rows.length === 0 ? (
              <div className="h-full min-h-[240px] flex items-center justify-center border border-dashed border-[#E4E7EC] rounded-lg">
                <p className="font-body-sm text-[#75777e]">Results will appear here.</p>
              </div>
            ) : (
              <div className="border border-[#E4E7EC] rounded-lg overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#E4E7EC] bg-[#f9f9ff]">
                      <th className="font-label-sm text-[#44474d] uppercase px-4 py-3">MPN</th>
                      <th className="font-label-sm text-[#44474d] uppercase px-4 py-3">Manufacturer</th>
                      <th className="font-label-sm text-[#44474d] uppercase px-4 py-3">Product</th>
                      <th className="font-label-sm text-[#44474d] uppercase px-4 py-3">Category</th>
                      <th className="font-label-sm text-[#44474d] uppercase px-4 py-3">Datasheet</th>
                      <th className="font-label-sm text-[#44474d] uppercase px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.mpn} className="border-b border-[#E4E7EC] last:border-b-0">
                        <td className="font-mono-label text-[#0B1F3A] px-4 py-3">{row.mpn}</td>
                        {row.status === "pending" && (
                          <td colSpan={5} className="px-4 py-3 font-body-sm text-[#75777e]">
                            <Loader2 size={14} className="animate-spin inline mr-2" /> Checking…
                          </td>
                        )}
                        {row.status === "not_found" && (
                          <td colSpan={5} className="px-4 py-3 font-body-sm text-[#75777e]">No match found</td>
                        )}
                        {row.status === "error" && (
                          <td colSpan={5} className="px-4 py-3 font-body-sm text-[#F04438]">Lookup failed — try again</td>
                        )}
                        {row.status === "found" && row.product && (
                          <>
                            <td className="font-body-sm text-[#111c2d] px-4 py-3">{row.product.manufacturer}</td>
                            <td className="font-body-sm text-[#111c2d] px-4 py-3">{row.product.productName}</td>
                            <td className="px-4 py-3">
                              {row.product.category ? <span className="tag">{row.product.category}</span> : "—"}
                            </td>
                            <td className="font-body-sm text-[#111c2d] px-4 py-3">
                              {row.product.datasheetUrl ? "Available" : "Unavailable"}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/products/${encodeURIComponent(row.mpn)}`}
                                className="font-label-md text-[#1769E0] hover:underline whitespace-nowrap"
                              >
                                View
                              </Link>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
