"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { UploadCloud, Loader2, Search } from "lucide-react";
import { uploadCatalogCsv, listCatalogImportRuns, importFromMouser, importFromElement14, importFromDigiKey, importFromNexar, type CatalogImportRun, type AdminProduct } from "@/lib/api/admin";

const statusColor: Record<string, string> = {
  COMPLETED: "bg-[#12B76A]/10 text-[#12B76A]",
  RUNNING: "bg-[#F79009]/10 text-[#F79009]",
  FAILED: "bg-[#F04438]/10 text-[#F04438]",
};

export default function AdminCatalogImportPage() {
  const [runs, setRuns] = useState<CatalogImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<"mouser" | "element14" | "digikey" | "nexar">("mouser");
  const [providerMpn, setProviderMpn] = useState("");
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerResult, setProviderResult] = useState<AdminProduct | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listCatalogImportRuns({ limit: 50 })
      .then((r) => setRuns(r.data))
      .catch(() => setError("Failed to load import history."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { queueMicrotask(() => load()); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadCatalogCsv(file);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleProviderLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const mpn = providerMpn.trim();
    if (!mpn) return;
    const sourceLabel = source === "mouser" ? "Mouser" : source === "element14" ? "element14" : source === "digikey" ? "DigiKey" : "Nexar";
    setProviderLoading(true);
    setProviderError(null);
    setProviderResult(null);
    try {
      const { run, product } = await (source === "mouser" ? importFromMouser(mpn) : source === "element14" ? importFromElement14(mpn) : source === "digikey" ? importFromDigiKey(mpn) : importFromNexar(mpn));
      if (run.status === "FAILED") {
        const message = Array.isArray(run.errorLog) && run.errorLog[0] && typeof run.errorLog[0] === "object"
          ? (run.errorLog[0] as { message?: string }).message
          : undefined;
        setProviderError(message ?? `${sourceLabel} lookup failed.`);
      } else if (!product) {
        setProviderError(`No product found on ${sourceLabel} for MPN "${mpn}".`);
      } else {
        setProviderResult(product);
      }
      load();
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : `${sourceLabel} lookup failed.`);
    } finally {
      setProviderLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-[#111c2d]">Catalog Import</h1>
        <p className="font-body-md text-[#44474d]">Bulk-load products from a CSV/XLSX file, or look up a single MPN through an approved distributor API.</p>
      </div>

      {error && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>}

      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6">
        <h2 className="font-headline-sm text-[#111c2d] mb-1">Distributor Single-Part Lookup</h2>
        <p className="font-body-sm text-[#44474d] mb-4">Imports one part through the same idempotent pipeline as CSV import. No supplier pricing is imported or shown publicly.</p>
        <form onSubmit={handleProviderLookup} className="flex flex-col sm:flex-row gap-3">
          <select aria-label="Catalog source" value={source} onChange={(event) => setSource(event.target.value as "mouser" | "element14" | "digikey" | "nexar")} disabled={providerLoading} className="px-3 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]">
            <option value="mouser">Mouser</option>
            <option value="element14">element14</option>
            <option value="digikey">DigiKey</option>
            <option value="nexar">Nexar</option>
          </select>
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
            <input
              value={providerMpn}
              onChange={(e) => setProviderMpn(e.target.value)}
              placeholder="e.g. STM32F103C8T6"
              disabled={providerLoading}
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]"
            />
          </div>
          <button type="submit" disabled={providerLoading || !providerMpn.trim()} className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md text-sm disabled:opacity-50">
            {providerLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {providerLoading ? "Looking up…" : `Look up on ${source === "mouser" ? "Mouser" : source === "element14" ? "element14" : source === "digikey" ? "DigiKey" : "Nexar"}`}
          </button>
        </form>
        {providerError && <p role="alert" className="mt-3 font-body-sm text-[#B42318]">{providerError}</p>}
        {providerResult && (
          <div className="mt-4 rounded-lg border border-[#12B76A]/30 bg-[#12B76A]/5 p-4 flex items-center justify-between">
            <div>
              <p className="font-label-md text-[#111c2d]">{providerResult.mpn} imported from {source === "mouser" ? "Mouser" : source === "element14" ? "element14" : source === "digikey" ? "DigiKey" : "Nexar"}</p>
              <p className="font-body-sm text-[#44474d]">{providerResult.manufacturer?.name} · {providerResult.name ?? providerResult.description ?? ""}</p>
            </div>
            <Link href={`/products/${providerResult.mpn}${providerResult.manufacturer?.id ? `?manufacturerId=${encodeURIComponent(providerResult.manufacturer.id)}` : ""}`} target="_blank" className="font-label-sm text-[#1769E0] hover:underline text-sm whitespace-nowrap">View on site →</Link>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6">
        <label className="border-2 border-dashed border-[#E4E7EC] rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#1769E0] transition-colors">
          {uploading ? <Loader2 size={32} className="animate-spin text-[#1769E0] mb-3" /> : <UploadCloud size={32} className="text-[#44474d] mb-3" />}
          <p className="font-label-md text-[#111c2d] mb-1">{uploading ? "Importing…" : "Click to upload a CSV or XLSX file"}</p>
          <p className="font-body-sm text-[#44474d]">Columns: mpn, manufacturer, name, description, category, package, mounting, lifecycle, datasheet</p>
          <input ref={fileInput} type="file" accept=".csv,.xlsx" onChange={handleUpload} disabled={uploading} className="hidden" />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E7EC]">
          <h2 className="font-headline-sm text-[#111c2d]">Import History</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={18} /> Loading…</div>
        ) : runs.length === 0 ? (
          <p className="py-12 text-center text-[#667085]">No imports have run yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                  {["Source", "Status", "Processed", "Created", "Updated", "Failed", "Started"].map((h) => (
                    <th key={h} className="px-5 py-3 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-5 py-3 font-mono-label text-sm text-[#111c2d]">{run.source}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-xs ${statusColor[run.status] ?? ""}`}>{run.status}</span>
                    </td>
                    <td className="px-5 py-3 font-mono-label text-sm">{run.itemsProcessed}</td>
                    <td className="px-5 py-3 font-mono-label text-sm text-[#12B76A]">{run.itemsCreated}</td>
                    <td className="px-5 py-3 font-mono-label text-sm text-[#1769E0]">{run.itemsUpdated}</td>
                    <td className="px-5 py-3 font-mono-label text-sm text-[#F04438]">{run.itemsFailed}</td>
                    <td className="px-5 py-3 font-body-sm text-sm text-[#44474d]">{new Date(run.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
