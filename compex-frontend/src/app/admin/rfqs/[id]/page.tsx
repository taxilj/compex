"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, Save } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { getAdminRfq, updateAdminRfqStatus, type AdminRfq } from "@/lib/api/admin";
import type { BackendRfqItem, RfqStatus } from "@/lib/api/rfqs";
import { StatusBadge } from "@/components/ui/StatusBadge";

const NEXT_STATUSES: Record<RfqStatus, RfqStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["SOURCING", "CANCELLED"],
  SOURCING: ["CANCELLED"],
  CANCELLED: [],
};

type AdminRfqDetail = AdminRfq & { items: BackendRfqItem[]; documents: unknown[] };

export default function AdminRfqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rfq, setRfq] = useState<AdminRfqDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<RfqStatus | "">("");
  const [internalNotes, setInternalNotes] = useState("");

  useEffect(() => {
    if (!id) return;
    getAdminRfq(id)
      .then((result) => {
        setRfq(result);
        setInternalNotes(result.internalNotes ?? "");
      })
      .catch((err) => setError(err instanceof ApiError && err.statusCode === 404 ? "RFQ not found." : "Failed to load RFQ."))
      .finally(() => setLoading(false));
  }, [id]);

  const allowed = useMemo(() => rfq ? NEXT_STATUSES[rfq.status] : [], [rfq]);

  async function saveStatus() {
    if (!rfq || !nextStatus) return;
    if (!window.confirm(`Move ${rfq.rfqNumber} to ${nextStatus.replaceAll("_", " ")}?`)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminRfqStatus(rfq.id, nextStatus, internalNotes || undefined);
      setRfq({ ...rfq, ...updated });
      setNextStatus("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the RFQ.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={22} /> Loading RFQ…</div>;
  if (!rfq) return <div className="py-20 text-center"><p className="text-[#B42318]">{error ?? "RFQ not found."}</p><Link href="/admin/rfqs" className="mt-4 inline-block text-[#1769E0] hover:underline">Back to RFQs</Link></div>;

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/rfqs" aria-label="Back to RFQs" className="rounded p-2 text-[#44474d] hover:bg-[#e8eeff]"><ArrowLeft size={20} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3"><h1 className="font-headline-lg text-[#111c2d]">{rfq.rfqNumber}</h1><StatusBadge status={rfq.status.toLowerCase()} /></div>
          <p className="font-body-sm text-[#44474d]">{rfq.customer.company.name} · {rfq.customer.user.firstName} {rfq.customer.user.lastName}</p>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-5 rounded-xl border border-[#E4E7EC] bg-white p-6 lg:col-span-2">
          <div className="flex flex-wrap justify-between gap-4">
            <div><p className="font-label-sm uppercase tracking-wide text-[#667085]">Customer account</p><p className="font-body-md text-[#111c2d]">{rfq.customer.accountNumber}</p><p className="font-body-sm text-[#667085]">{rfq.customer.user.email}</p></div>
            <div><p className="font-label-sm uppercase tracking-wide text-[#667085]">Delivery</p><p className="flex items-center gap-1 font-body-md text-[#111c2d]"><MapPin size={15} /> {rfq.deliveryLocation ?? "Not specified"}</p><p className="font-body-sm text-[#667085]">Required {rfq.requiredDate?.split("T")[0] ?? "date not specified"}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="bg-[#f0f3ff]"><tr>{["#", "MPN", "Manufacturer", "Description", "Quantity", "Status"].map((h) => <th key={h} className="px-4 py-3 font-label-sm uppercase tracking-wide text-[#667085]">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#E4E7EC]">{rfq.items.map((item) => <tr key={item.id}><td className="px-4 py-3">{item.lineNumber}</td><td className="px-4 py-3 font-mono text-[#0B1F3A]">{item.mpn}</td><td className="px-4 py-3">{item.manufacturer ?? "—"}</td><td className="px-4 py-3">{item.description ?? "—"}</td><td className="px-4 py-3 font-mono">{item.quantity}</td><td className="px-4 py-3">{item.status}</td></tr>)}</tbody>
            </table>
          </div>
          {rfq.items.length === 0 && <p className="text-center font-body-sm text-[#667085]">No line items are attached to this RFQ.</p>}
        </section>

        <aside className="rounded-xl border border-[#E4E7EC] bg-white p-6">
          <h2 className="font-headline-sm text-[#111c2d]">Review & transition</h2>
          <label className="mt-5 block font-label-sm text-[#44474d]" htmlFor="internal-notes">Internal notes</label>
          <textarea id="internal-notes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={5} maxLength={2000} className="mt-1 w-full rounded border border-[#E4E7EC] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
          {allowed.length > 0 ? <>
            <label className="mt-4 block font-label-sm text-[#44474d]" htmlFor="next-status">Next status</label>
            <select id="next-status" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as RfqStatus | "")} className="mt-1 w-full rounded border border-[#E4E7EC] px-3 py-2"><option value="">Select a valid transition</option>{allowed.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>
            <button onClick={() => void saveStatus()} disabled={!nextStatus || saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-[#1769E0] px-4 py-2.5 font-label-md text-white hover:bg-[#1257b8] disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} /> {saving ? "Saving…" : "Save transition"}</button>
          </> : <p className="mt-4 rounded bg-[#f0f3ff] p-3 font-body-sm text-[#44474d]">No further status transition is available.</p>}
        </aside>
      </div>
    </div>
  );
}
