"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Send, Plus, CheckCircle2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { createQuotationFromSourcing, createVendorRfq, listVendorRfqs, listVendors, recordVendorQuote, selectVendorQuote, sendVendorRfq, getAdminRfq, type AdminVendorRfq, type AdminRfq, type Vendor } from "@/lib/api/admin";
import type { BackendRfqItem } from "@/lib/api/rfqs";

type RfqDetail = AdminRfq & { items: BackendRfqItem[] };

export default function VendorRfqsPage() {
  const params = useSearchParams();
  const rfqId = params.get("rfqId") ?? undefined;
  const [rfqs, setRfqs] = useState<AdminVendorRfq[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rfq, setRfq] = useState<RfqDetail | null>(null);
  const [vendorIds, setVendorIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteInputs, setQuoteInputs] = useState<Record<string, { itemId: string; cost: string }>>({});
  const [marginPercent, setMarginPercent] = useState("0");

  const refresh = async () => {
    const result = await listVendorRfqs({ rfqId, limit: 100 });
    setRfqs(result.data);
  };

  useEffect(() => {
    Promise.all([listVendors(), listVendorRfqs({ rfqId, limit: 100 }), rfqId ? getAdminRfq(rfqId) : Promise.resolve(null)])
      .then(([vendorResult, vendorRfqResult, selectedRfq]) => {
        setVendors(vendorResult.data);
        setRfqs(vendorRfqResult.data);
        setRfq(selectedRfq as RfqDetail | null);
        if (selectedRfq) setItemIds((selectedRfq as RfqDetail).items.map((item) => item.id));
      })
      .catch(() => setError("Could not load sourcing data."))
      .finally(() => setLoading(false));
  }, [rfqId]);

  const unquotedItems = useMemo(() => rfq?.items ?? [], [rfq]);

  const toggle = (values: string[], value: string, setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((id) => id !== value) : [...values, value]);
  };

  async function createSelected() {
    if (!rfq || vendorIds.length === 0 || itemIds.length === 0) return;
    setSaving(true); setError(null);
    try {
      await Promise.all(vendorIds.map((vendorId) => createVendorRfq({ rfqId: rfq.id, vendorId, itemIds })));
      setVendorIds([]);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create vendor RFQs.");
    } finally { setSaving(false); }
  }

  async function send(id: string) {
    setSaving(true); setError(null);
    try { await sendVendorRfq(id); await refresh(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not send vendor RFQ."); }
    finally { setSaving(false); }
  }

  async function saveQuote(vendorRfq: AdminVendorRfq) {
    const input = quoteInputs[vendorRfq.id];
    const unitCost = Number(input?.cost);
    if (!input?.itemId || !Number.isFinite(unitCost) || unitCost <= 0) return;
    setSaving(true); setError(null);
    try { await recordVendorQuote(vendorRfq.id, { rfqItemId: input.itemId, unitCost }); await refresh(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not record vendor price."); }
    finally { setSaving(false); }
  }

  async function choose(vendorRfqId: string, quoteId: string) {
    setSaving(true); setError(null);
    try { await selectVendorQuote(vendorRfqId, quoteId, "SELECTED"); await refresh(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not select vendor quote."); }
    finally { setSaving(false); }
  }

  const selectedLineCount = useMemo(() => new Set(rfqs.flatMap((vendorRfq) => vendorRfq.quotes.filter((quote) => quote.status === "SELECTED").map((quote) => quote.rfqItemId))).size, [rfqs]);
  async function createCustomerQuotation() {
    if (!rfq) return;
    setSaving(true); setError(null);
    try {
      await createQuotationFromSourcing(rfq.id, {
        marginPercent: Number(marginPercent),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create customer quotation.");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={22} /> Loading sourcing…</div>;

  return <div className="mx-auto max-w-[1180px] space-y-6">
    <div><h1 className="font-headline-lg text-[#111c2d]">Vendor sourcing</h1><p className="font-body-sm text-[#667085]">Create vendor RFQs, record offers, and select the winning line price.</p></div>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}
    {rfq && <section className="rounded-xl border border-[#E4E7EC] bg-white p-6 space-y-5"><div><h2 className="font-headline-sm">Source {rfq.rfqNumber}</h2><p className="text-sm text-[#667085]">Select vendors and the customer requirement lines to include.</p></div><div className="grid gap-5 lg:grid-cols-2"><fieldset><legend className="font-label-md text-[#44474d]">Vendors</legend><div className="mt-2 space-y-2">{vendors.map((vendor) => <label key={vendor.id} className="flex items-center gap-2 rounded border p-3"><input type="checkbox" checked={vendorIds.includes(vendor.id)} onChange={() => toggle(vendorIds, vendor.id, setVendorIds)} /> <span>{vendor.name}</span><span className="text-xs text-[#667085]">{vendor.contactEmail}</span></label>)}</div></fieldset><fieldset><legend className="font-label-md text-[#44474d]">RFQ lines</legend><div className="mt-2 space-y-2">{unquotedItems.map((item) => <label key={item.id} className="flex items-center gap-2 rounded border p-3"><input type="checkbox" checked={itemIds.includes(item.id)} onChange={() => toggle(itemIds, item.id, setItemIds)} /> <span className="font-mono">{item.mpn}</span><span>{item.quantity} pcs</span></label>)}</div></fieldset></div><button onClick={() => void createSelected()} disabled={saving || vendorIds.length === 0 || itemIds.length === 0} className="inline-flex items-center gap-2 rounded bg-[#1769E0] px-4 py-2.5 text-white disabled:opacity-50"><Plus size={16} /> Create vendor RFQs</button></section>}
    {rfq && <section className="rounded-xl border border-[#E4E7EC] bg-white p-5"><h2 className="font-headline-sm">Create customer quotation</h2><p className="mt-1 text-sm text-[#667085]">Selected quotes: {selectedLineCount} of {rfq.items.length} RFQ lines. Vendor costs remain internal; the customer receives the marked-up selling price.</p><div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm">Margin % <input type="number" min="0" max="1000" step="0.01" value={marginPercent} onChange={(e) => setMarginPercent(e.target.value)} className="ml-2 w-24 rounded border px-2 py-1" /></label><button onClick={() => void createCustomerQuotation()} disabled={saving || selectedLineCount !== rfq.items.length} className="rounded bg-[#1769E0] px-4 py-2 text-white disabled:opacity-50">Create draft quotation</button></div></section>}
    <section className="space-y-4">{rfqs.length === 0 ? <p className="rounded border bg-white p-6 text-[#667085]">No vendor RFQs found. Open an RFQ in sourcing to create one.</p> : rfqs.map((vendorRfq) => <article key={vendorRfq.id} className="rounded-xl border border-[#E4E7EC] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-label-md text-[#111c2d]">{vendorRfq.vendorRfqNumber} · {vendorRfq.vendor.name}</h2><p className="text-sm text-[#667085]">{vendorRfq.status} · {vendorRfq.items.length} line(s)</p></div>{vendorRfq.status === "DRAFT" && <button onClick={() => void send(vendorRfq.id)} disabled={saving} className="inline-flex items-center gap-2 rounded border border-[#1769E0] px-3 py-2 text-[#1769E0]"><Send size={15} /> Send</button>}</div><div className="mt-4 grid gap-3 md:grid-cols-2">{vendorRfq.quotes.map((quote) => <div key={quote.id} className="rounded border p-3 text-sm"><p>Line: {quote.rfqItemId}</p><p>{quote.unitCost} {quote.currency} · {quote.status}</p>{quote.status === "RECEIVED" && <button onClick={() => void choose(vendorRfq.id, quote.id)} disabled={saving} className="mt-2 inline-flex items-center gap-1 text-[#1769E0]"><CheckCircle2 size={14} /> Select price</button>}</div>)}</div>{vendorRfq.items.length > 0 && <div className="mt-4 flex flex-wrap gap-2"><select value={quoteInputs[vendorRfq.id]?.itemId ?? ""} onChange={(e) => setQuoteInputs((v) => ({ ...v, [vendorRfq.id]: { itemId: e.target.value, cost: v[vendorRfq.id]?.cost ?? "" } }))} className="rounded border px-3 py-2"><option value="">RFQ line</option>{vendorRfq.items.map((item) => <option key={item.id} value={item.rfqItemId}>{item.rfqItemId}</option>)}</select><input type="number" min="0.0001" step="0.0001" placeholder="Unit cost (USD)" value={quoteInputs[vendorRfq.id]?.cost ?? ""} onChange={(e) => setQuoteInputs((v) => ({ ...v, [vendorRfq.id]: { itemId: v[vendorRfq.id]?.itemId ?? "", cost: e.target.value } }))} className="rounded border px-3 py-2" /><button onClick={() => void saveQuote(vendorRfq)} disabled={saving} className="rounded bg-[#0B1F3A] px-3 py-2 text-white">Record price</button></div>}</article>)}</section>
  </div>;
}
