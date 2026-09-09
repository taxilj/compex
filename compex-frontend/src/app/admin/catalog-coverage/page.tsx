"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, Factory, FolderTree, ImageOff, FileX, AlertTriangle } from "lucide-react";
import { getCatalogCoverage, type CatalogCoverage } from "@/lib/api/admin";

function MiniBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="w-full h-1.5 bg-[#E4E7EC] rounded-full overflow-hidden">
      <div className="h-full bg-[#1769E0] rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

export default function AdminCatalogCoveragePage() {
  const [data, setData] = useState<CatalogCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalogCoverage()
      .then(setData)
      .catch(() => setError("Failed to load catalog coverage."));
  }, []);

  if (error) {
    return <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>;
  }

  if (!data) {
    return <div className="flex items-center justify-center py-24 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={18} /> Loading…</div>;
  }

  const maxByManufacturer = Math.max(1, ...data.byManufacturer.map((m) => m.productCount));
  const maxByCategory = Math.max(1, ...data.byCategory.map((c) => c.productCount));

  const kpis = [
    { label: "Total Products", value: data.totals.products, icon: Package },
    { label: "Manufacturers", value: data.totals.manufacturers, icon: Factory },
    { label: "Categories", value: data.totals.categories, icon: FolderTree },
  ];

  const quality = [
    { label: "Missing category", value: data.dataQuality.productsMissingCategory },
    { label: "Missing manufacturer", value: data.dataQuality.productsMissingManufacturer },
    { label: "Missing image", value: data.dataQuality.productsMissingImage },
    { label: "Missing datasheet", value: data.dataQuality.productsMissingDatasheet },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-[#111c2d]">Catalog Coverage</h1>
        <p className="font-body-md text-[#44474d]">Live data-quality snapshot of the public catalog. Internal use only — never exposed publicly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body-sm text-[#44474d] text-sm">{label}</span>
              <div className="w-8 h-8 bg-[#f0f3ff] rounded-lg flex items-center justify-center">
                <Icon size={15} className="text-[#1769E0]" />
              </div>
            </div>
            <p className="font-headline-md text-[#111c2d] text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
        <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">Data Quality</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quality.map((q) => (
            <div key={q.label} className="flex items-center gap-3 p-3 rounded-lg bg-[#f9f9ff] border border-[#E4E7EC]">
              {q.value > 0 ? <AlertTriangle size={16} className="text-[#F79009] shrink-0" /> : <span className="w-4 h-4 shrink-0" />}
              <div>
                <p className="font-headline-sm text-[#111c2d]">{q.value}</p>
                <p className="font-body-sm text-[#44474d] text-xs">{q.label}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[#E4E7EC] font-body-sm text-[#44474d]">
          <span className="flex items-center gap-1.5"><ImageOff size={14} /> {data.dataQuality.productsWithImage} / {data.totals.products} have an image</span>
          <span className="flex items-center gap-1.5"><FileX size={14} /> {data.dataQuality.productsWithDatasheet} / {data.totals.products} have a datasheet</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
          <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">Products by Manufacturer</h2>
          {data.byManufacturer.length === 0 ? (
            <p className="font-body-sm text-[#44474d]">No manufacturers yet.</p>
          ) : (
            <div className="space-y-4">
              {data.byManufacturer.map((m) => (
                <div key={m.id}>
                  <div className="flex justify-between mb-1">
                    <span className="font-body-sm text-[#0B1F3A] text-sm">{m.name}</span>
                    <span className="font-label-sm text-[#44474d] text-sm">{m.productCount}</span>
                  </div>
                  <MiniBar value={m.productCount} max={maxByManufacturer} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
          <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">Products by Category</h2>
          {data.byCategory.length === 0 ? (
            <p className="font-body-sm text-[#44474d]">No categories yet.</p>
          ) : (
            <div className="space-y-4">
              {data.byCategory.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between mb-1">
                    <span className="font-body-sm text-[#0B1F3A] text-sm">{c.name}</span>
                    <span className="font-label-sm text-[#44474d] text-sm">{c.productCount}</span>
                  </div>
                  <MiniBar value={c.productCount} max={maxByCategory} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
        <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">Provider Source Coverage</h2>
        {data.productSourceCoverage.length === 0 ? (
          <p className="font-body-sm text-[#44474d]">No provider-sourced records yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {data.productSourceCoverage.map((s) => (
              <span key={s.source} className="tag">{s.source}: {s.count} record{s.count !== 1 ? "s" : ""}</span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
        <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">Last Import Run</h2>
        {!data.lastImportRun ? (
          <p className="font-body-sm text-[#44474d]">No imports have run yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-body-sm text-[#44474d]">
            <div><p className="text-xs uppercase tracking-wider mb-1">Source</p><p className="font-mono-label text-[#111c2d]">{data.lastImportRun.source}</p></div>
            <div><p className="text-xs uppercase tracking-wider mb-1">Status</p><p className="text-[#111c2d]">{data.lastImportRun.status}</p></div>
            <div><p className="text-xs uppercase tracking-wider mb-1">Started</p><p className="text-[#111c2d]">{new Date(data.lastImportRun.startedAt).toLocaleString()}</p></div>
            <div><p className="text-xs uppercase tracking-wider mb-1">Processed / Created / Updated / Failed</p><p className="text-[#111c2d]">{data.lastImportRun.itemsProcessed} / {data.lastImportRun.itemsCreated} / {data.lastImportRun.itemsUpdated} / {data.lastImportRun.itemsFailed}</p></div>
          </div>
        )}
      </div>

      {data.recentImportErrors.length > 0 && (
        <div className="bg-white rounded-xl border border-[#F04438]/30 p-5 shadow-sm">
          <h2 className="font-label-md text-[#B42318] font-semibold mb-4">Recent Import Errors</h2>
          <div className="space-y-3">
            {data.recentImportErrors.map((run, i) => (
              <div key={i} className="flex items-center justify-between border-b border-[#E4E7EC] last:border-0 pb-3 last:pb-0">
                <div>
                  <p className="font-mono-label text-[#111c2d] text-sm">{run.source} — {run.status}</p>
                  <p className="font-body-sm text-[#44474d] text-xs">{new Date(run.startedAt).toLocaleString()}</p>
                </div>
                <span className="font-label-sm text-[#F04438] text-sm">{run.itemsFailed} failed</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
