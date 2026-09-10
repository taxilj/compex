"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { getRfq, type BackendRfq, type BackendRfqItem } from "@/lib/api/rfqs";
import { listRfqDocuments, type RfqDocument } from "@/lib/api/documents";
import { ApiError } from "@/lib/api/client";
import {
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
} from "lucide-react";

const DOC_STATUS_CONFIG: Record<
  RfqDocument["processingStatus"],
  { label: string; icon: React.ElementType; className: string }
> = {
  UPLOADED: { label: "Uploaded", icon: AlertCircle, className: "text-[#F79009]" },
  PROCESSING: { label: "Processing", icon: Loader2, className: "text-[#1769E0]" },
  COMPLETED: { label: "Processed", icon: CheckCircle2, className: "text-[#12B76A]" },
  FAILED: { label: "Failed", icon: XCircle, className: "text-[#F04438]" },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function isComplete(item: BackendRfqItem): boolean {
  return Boolean(item.manufacturer) && Boolean(item.description);
}

type DocumentsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; documents: RfqDocument[] };

export default function RFQBOMPage() {
  const params = useParams<{ id: string }>();
  const [rfq, setRfq] = useState<(BackendRfq & { items: BackendRfqItem[] }) | null>(null);
  const [documentsState, setDocumentsState] = useState<DocumentsState>({ status: "loading" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFoundErr, setNotFoundErr] = useState(false);

  const loadDocuments = useCallback(() => {
    if (!params.id) return;
    setDocumentsState({ status: "loading" });
    listRfqDocuments(params.id)
      .then((documents) => setDocumentsState({ status: "ready", documents }))
      .catch((err) => {
        // A failed document fetch must never be mistaken for "no file
        // uploaded" — that's a false claim about the RFQ's actual state.
        console.error(`Failed to load documents for RFQ ${params.id}:`, err);
        setDocumentsState({ status: "error" });
      });
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    getRfq(params.id)
      .then((rfqData) => {
        setRfq(rfqData);
        // Missing/failed document metadata shouldn't fail the whole page —
        // the RFQ itself already loaded successfully.
        loadDocuments();
      })
      .catch((err) => {
        if (err instanceof ApiError && err.statusCode === 404) {
          setNotFoundErr(true);
        } else {
          console.error(`Failed to load RFQ ${params.id}:`, err);
          setError("Failed to load this RFQ's BOM. Please try again.");
        }
      })
      .finally(() => setLoading(false));
  }, [params.id, loadDocuments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#44474d]">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading BOM…
      </div>
    );
  }

  if (notFoundErr) notFound();

  if (error || !rfq) {
    return (
      <div className="max-w-[860px] mx-auto py-20 text-center">
        <p className="font-body-md text-red-600">{error ?? "An error occurred."}</p>
        <Link href="/portal/rfqs" className="text-[#1769E0] hover:underline font-label-md mt-4 block">
          ← Back to RFQs
        </Link>
      </div>
    );
  }

  const completeCount = rfq.items.filter(isComplete).length;
  const missingCount = rfq.items.length - completeCount;
  const latestDoc = documentsState.status === "ready" ? (documentsState.documents[0] ?? null) : null;

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
          <h1 className="font-headline-lg text-[#111c2d]">BOM Review — {rfq.rfqNumber}</h1>
          <p className="font-body-md text-[#44474d] mt-0.5">
            Line items and uploaded BOM file for this RFQ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* File info panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-[#E4E7EC] p-5">
            {documentsState.status === "loading" && (
              <p className="font-body-sm text-[#44474d] flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading document info…
              </p>
            )}
            {documentsState.status === "error" && (
              <div className="space-y-2">
                <p className="font-body-sm text-[#F04438] flex items-center gap-1.5">
                  <XCircle size={14} /> Unable to load BOM document information
                </p>
                <button
                  onClick={loadDocuments}
                  className="font-label-sm text-[#1769E0] hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
            {documentsState.status === "ready" && (
              latestDoc ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded bg-[#f0f3ff] flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={22} className="text-[#1769E0]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-label-md text-[#111c2d] truncate">{latestDoc.fileName}</p>
                      <p className="font-body-sm text-[#44474d] text-xs">
                        {latestDoc.createdAt.split("T")[0]} · {formatBytes(latestDoc.fileSizeBytes)}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-[#E4E7EC] pt-4">
                    {(() => {
                      const cfg = DOC_STATUS_CONFIG[latestDoc.processingStatus];
                      const Icon = cfg.icon;
                      return (
                        <span className={`flex items-center gap-1.5 font-label-sm text-sm ${cfg.className}`}>
                          <Icon size={14} /> {cfg.label}
                        </span>
                      );
                    })()}
                    {latestDoc.processingStatus === "FAILED" && latestDoc.processingError && (
                      <p className="font-body-sm text-[#F04438] text-xs mt-2">{latestDoc.processingError}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="font-body-sm text-[#44474d]">
                  No BOM file uploaded — items on this RFQ were added manually.
                </p>
              )
            )}
            <div className="space-y-2.5 border-t border-[#E4E7EC] pt-4 mt-4">
              <div className="flex justify-between font-body-sm">
                <span className="text-[#44474d]">Total Lines</span>
                <span className="text-[#111c2d] font-medium">{rfq.items.length}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-[#44474d]">Complete</span>
                <span className="text-[#12B76A] font-medium">{completeCount}</span>
              </div>
              <div className="flex justify-between font-body-sm border-t border-[#E4E7EC] pt-2.5">
                <span className="text-[#44474d]">Missing Info</span>
                <span className="text-[#F79009] font-medium">{missingCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="lg:col-span-3 bg-white rounded-lg border border-[#E4E7EC] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E7EC]">
            <h2 className="font-headline-sm text-[#111c2d]">Line Items</h2>
          </div>
          {rfq.items.length === 0 ? (
            <p className="font-body-sm text-[#44474d] p-6">No items added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="bg-[#f0f3ff]">
                    {["#", "Part Number", "Manufacturer", "Description", "Qty", "Data"].map((h) => (
                      <th
                        key={h}
                        className="py-2.5 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider text-xs"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {rfq.items.map((item, i) => {
                    const complete = isComplete(item);
                    return (
                      <tr key={item.id} className="hover:bg-[#f9f9ff]">
                        <td className="py-3 px-4 font-mono-label text-[#44474d] text-sm">{i + 1}</td>
                        <td className="py-3 px-4 font-mono-label text-[#0B1F3A] font-medium">{item.mpn}</td>
                        <td className="py-3 px-4 font-body-sm text-[#111c2d]">{item.manufacturer ?? "—"}</td>
                        <td className="py-3 px-4 font-body-sm text-[#44474d] max-w-[160px] truncate">
                          {item.description ?? "—"}
                        </td>
                        <td className="py-3 px-4 font-mono-label text-[#111c2d]">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`flex items-center gap-1.5 font-label-sm text-sm ${
                              complete ? "text-[#12B76A]" : "text-[#F79009]"
                            }`}
                          >
                            {complete ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            {complete ? "Complete" : "Missing info"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-6 py-4 border-t border-[#E4E7EC] flex justify-end">
            <Link
              href={`/portal/rfqs/${rfq.id}`}
              className="bg-[#1769E0] text-white px-6 py-2.5 rounded font-label-md hover:bg-[#1456c0] transition-colors"
            >
              Back to RFQ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
