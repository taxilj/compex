"use client";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { rfqs } from "@/data/mock/rfqs";
import { quotes } from "@/data/mock/quotes";
import {
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Edit2,
  Trash2,
  Plus,
} from "lucide-react";

type LineStatus = "ready" | "review_required" | "invalid";

const STATUS_CONFIG: Record<
  LineStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  ready: { label: "Ready", icon: CheckCircle2, className: "text-[#12B76A]" },
  review_required: { label: "Review Required", icon: AlertCircle, className: "text-[#F79009]" },
  invalid: { label: "Invalid", icon: XCircle, className: "text-[#F04438]" },
};

const STATUS_CYCLE: LineStatus[] = ["ready", "ready", "review_required", "invalid"];

export default function RFQBOMPage() {
  const params = useParams<{ id: string }>();
  const rfq = rfqs.find((r) => r.id === params.id);
  if (!rfq) notFound();

  const lines = rfq.items.map((item, i) => ({
    ...item,
    line: i + 1,
    status: STATUS_CYCLE[i % STATUS_CYCLE.length],
  }));

  const ready = lines.filter((l) => l.status === "ready").length;
  const review = lines.filter((l) => l.status === "review_required").length;
  const invalid = lines.filter((l) => l.status === "invalid").length;

  const relatedQuote = quotes.find((q) => q.rfqId === rfq.id);
  const continueHref = relatedQuote ? `/portal/quotes/${relatedQuote.id}` : "/portal/quotes";

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/portal/rfqs/${rfq.id}`}
          className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">BOM Review — {rfq.number}</h1>
          <p className="font-body-md text-[#44474d] mt-0.5">
            Review your Bill of Materials before requesting a quote
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File info panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded bg-[#f0f3ff] flex items-center justify-center">
                <FileSpreadsheet size={22} className="text-[#1769E0]" />
              </div>
              <div className="min-w-0">
                <p className="font-label-md text-[#111c2d] truncate">BOM_Upload.xlsx</p>
                <p className="font-body-sm text-[#44474d] text-xs">2026-08-10</p>
              </div>
            </div>
            <div className="space-y-2.5 border-t border-[#E4E7EC] pt-4">
              <div className="flex justify-between font-body-sm">
                <span className="text-[#44474d]">Total Lines</span>
                <span className="text-[#111c2d] font-medium">{lines.length}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-[#44474d]">Valid Lines</span>
                <span className="text-[#12B76A] font-medium">{ready}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-[#44474d]">Review Required</span>
                <span className="text-[#F79009] font-medium">{review}</span>
              </div>
              <div className="flex justify-between font-body-sm border-t border-[#E4E7EC] pt-2.5">
                <span className="text-[#44474d]">Invalid</span>
                <span className="text-[#F04438] font-medium">{invalid}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-[#E4E7EC] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E7EC] flex items-center justify-between">
            <h2 className="font-headline-sm text-[#111c2d]">Line Items</h2>
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E4E7EC] text-[#44474d] rounded font-label-sm hover:border-[#1769E0] hover:text-[#1769E0] transition-colors text-sm">
              <Plus size={14} /> Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="bg-[#f0f3ff]">
                  {["#", "Part Number", "Manufacturer", "Description", "Qty", "Status", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="py-2.5 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider text-xs"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {lines.map((line) => {
                  const cfg = STATUS_CONFIG[line.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={line.id} className="hover:bg-[#f9f9ff]">
                      <td className="py-3 px-4 font-mono-label text-[#44474d] text-sm">
                        {line.line}
                      </td>
                      <td className="py-3 px-4 font-mono-label text-[#0B1F3A] font-medium">
                        {line.mpn}
                      </td>
                      <td className="py-3 px-4 font-body-sm text-[#111c2d]">
                        {line.manufacturer}
                      </td>
                      <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[160px] truncate">
                        {line.description}
                      </td>
                      <td className="py-3 px-4 font-mono-label text-[#111c2d]">
                        {line.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`flex items-center gap-1.5 font-label-sm text-sm ${cfg.className}`}
                        >
                          <Icon size={14} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <button className="p-1.5 text-[#44474d] hover:text-[#1769E0] transition-colors rounded hover:bg-[#f0f3ff]">
                            <Edit2 size={14} />
                          </button>
                          <button className="p-1.5 text-[#44474d] hover:text-[#F04438] transition-colors rounded hover:bg-[#fef3f2]">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-[#E4E7EC] flex justify-end">
            <Link
              href={continueHref}
              className="bg-[#1769E0] text-white px-6 py-2.5 rounded font-label-md hover:bg-[#1456c0] transition-colors"
            >
              Continue to Quote
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}