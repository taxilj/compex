"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Plus, Trash2, Upload, CheckCircle, Loader2 } from "lucide-react";
import { createRfq, addRfqItem, uploadBom, submitRfq, type RfqPriority } from "@/lib/api/rfqs";
import { ApiError } from "@/lib/api/client";

type StepNum = 1 | 2 | 3 | 4 | 5;

interface CompEntry {
  id: string;
  mpn: string;
  manufacturer: string;
  quantity: string;
  targetPrice: string;
}

const STEP_LABELS = ["Requirement", "Components", "Delivery", "Review", "Submit"] as const;

const INPUT_CLS =
  "w-full px-3 py-2.5 border border-[#E4E7EC] rounded font-body-md text-[#111c2d] focus:outline-none focus:border-[#1769E0]";

const PRIORITY_MAP: Record<string, RfqPriority> = {
  low: "LOW",
  standard: "MEDIUM",
  urgent: "HIGH",
};

export default function NewRFQPage() {
  const [step, setStep] = useState<StepNum>(1);
  const [req, setReq] = useState({ company: "", contact: "", email: "", phone: "", gstin: "" });
  const [comps, setComps] = useState<CompEntry[]>([
    { id: "c0", mpn: "", manufacturer: "", quantity: "", targetPrice: "" },
  ]);
  const [bomFile, setBomFile] = useState<File | null>(null);
  const [delivery, setDelivery] = useState({ location: "", requiredDate: "", priority: "standard", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRfqId, setSubmittedRfqId] = useState<string | null>(null);

  const addComp = () =>
    setComps((prev) => [...prev, { id: `c${Date.now()}`, mpn: "", manufacturer: "", quantity: "", targetPrice: "" }]);
  const removeComp = (id: string) => setComps((prev) => prev.filter((c) => c.id !== id));
  const updateComp = (id: string, field: keyof CompEntry, val: string) =>
    setComps((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: val } : c)));

  const next = () => { setSubmitError(null); setStep((s) => (Math.min(s + 1, 5) as StepNum)); };
  const back = () => { setSubmitError(null); setStep((s) => (Math.max(s - 1, 1) as StepNum)); };

  const handleSubmit = async () => {
    const validComps = comps.filter((c) => c.mpn.trim());
    if (!bomFile && validComps.length === 0) {
      setSubmitError("Add at least one component or select a BOM file.");
      return;
    }
    if (validComps.some((c) => !Number.isInteger(Number(c.quantity)) || Number(c.quantity) < 1)) {
      setSubmitError("Every component needs a whole-number quantity of at least 1.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const rfq = await createRfq({
        deliveryLocation: delivery.location || undefined,
        requiredDate: delivery.requiredDate || undefined,
        priority: PRIORITY_MAP[delivery.priority] ?? "MEDIUM",
        additionalNotes: [
          delivery.notes.trim(),
          req.company.trim() && `Requester company: ${req.company.trim()}`,
          req.contact.trim() && `Requester contact: ${req.contact.trim()}`,
          req.email.trim() && `Requester email: ${req.email.trim()}`,
          req.phone.trim() && `Requester phone: ${req.phone.trim()}`,
          req.gstin.trim() && `GSTIN: ${req.gstin.trim()}`,
        ].filter(Boolean).join("\n") || undefined,
      });

      if (bomFile) {
        await uploadBom(rfq.id, bomFile);
      }

      for (const c of validComps) {
        await addRfqItem(rfq.id, {
          mpn: c.mpn.trim(),
          manufacturer: c.manufacturer.trim() || undefined,
          quantity: parseInt(c.quantity, 10) || 1,
          targetPriceUsd: c.targetPrice ? parseFloat(c.targetPrice) : undefined,
        });
      }

      await submitRfq(rfq.id);
      setSubmittedRfqId(rfq.id);
      setStep(5);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Submission failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[860px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/portal/rfqs" className="p-2 text-[#44474d] hover:text-[#0B1F3A] rounded hover:bg-[#e8eeff] transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-headline-lg text-[#111c2d]">New RFQ</h1>
      </div>

      <div className="flex items-start w-full">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as StepNum;
          const done = step > n;
          const active = step === n;
          return (
            <div key={label} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${done ? "bg-[#12B76A] text-white" : active ? "bg-[#0B1F3A] text-white" : "bg-[#E4E7EC] text-[#44474d]"}`}>
                  {done ? <CheckCircle size={16} /> : `0${n}`}
                </div>
                <span className={`font-label-sm text-xs text-center ${active ? "text-[#0B1F3A] font-medium" : "text-[#44474d]"}`}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-0.5 mt-4 mx-1 ${done ? "bg-[#12B76A]" : "bg-[#E4E7EC]"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-headline-sm text-[#111c2d]">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block font-label-sm text-[#44474d] mb-1.5">Company Name</label>
                <input type="text" value={req.company} onChange={(e) => setReq((r) => ({ ...r, company: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block font-label-sm text-[#44474d] mb-1.5">Contact Person</label>
                <input type="text" value={req.contact} onChange={(e) => setReq((r) => ({ ...r, contact: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block font-label-sm text-[#44474d] mb-1.5">Email Address</label>
                <input type="email" value={req.email} onChange={(e) => setReq((r) => ({ ...r, email: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block font-label-sm text-[#44474d] mb-1.5">Phone Number</label>
                <input type="tel" value={req.phone} onChange={(e) => setReq((r) => ({ ...r, phone: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block font-label-sm text-[#44474d] mb-1.5">GSTIN</label>
                <input type="text" value={req.gstin} onChange={(e) => setReq((r) => ({ ...r, gstin: e.target.value }))} className={INPUT_CLS} />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-[#111c2d]">Components</h2>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-3 py-1.5 border border-[#E4E7EC] rounded font-label-sm text-[#44474d] cursor-pointer hover:border-[#1769E0] hover:text-[#1769E0] transition-colors text-sm">
                  <Upload size={14} /> Upload BOM
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => setBomFile(e.target.files?.[0] ?? null)} />
                </label>
                <button onClick={addComp} className="flex items-center gap-2 px-3 py-1.5 bg-[#0B1F3A] text-white rounded font-label-sm hover:bg-[#1a3357] transition-colors text-sm">
                  <Plus size={14} /> Add Component
                </button>
              </div>
            </div>
            {bomFile && (
              <div className="bg-[#f0f3ff] border border-[#1769E0]/30 rounded p-3 font-body-sm text-[#0B1F3A]">
                BOM selected: <strong>{bomFile.name}</strong> ({(bomFile.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px]">
                <thead>
                  <tr className="bg-[#f0f3ff]">
                    {["Part Number", "Manufacturer", "Quantity", "Target Price (USD)", ""].map((h) => (
                      <th key={h} className="py-2.5 px-3 text-left font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EC]">
                  {comps.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 px-3"><input type="text" value={c.mpn} onChange={(e) => updateComp(c.id, "mpn", e.target.value)} placeholder="e.g. STM32F103" className="w-full px-2 py-1.5 border border-[#E4E7EC] rounded font-body-sm text-[#111c2d] focus:outline-none focus:border-[#1769E0]" /></td>
                      <td className="py-2 px-3"><input type="text" value={c.manufacturer} onChange={(e) => updateComp(c.id, "manufacturer", e.target.value)} placeholder="Manufacturer" className="w-full px-2 py-1.5 border border-[#E4E7EC] rounded font-body-sm text-[#111c2d] focus:outline-none focus:border-[#1769E0]" /></td>
                      <td className="py-2 px-3"><input type="number" value={c.quantity} onChange={(e) => updateComp(c.id, "quantity", e.target.value)} className="w-full px-2 py-1.5 border border-[#E4E7EC] rounded font-body-sm text-[#111c2d] focus:outline-none focus:border-[#1769E0]" /></td>
                      <td className="py-2 px-3"><input type="number" value={c.targetPrice} onChange={(e) => updateComp(c.id, "targetPrice", e.target.value)} className="w-full px-2 py-1.5 border border-[#E4E7EC] rounded font-body-sm text-[#111c2d] focus:outline-none focus:border-[#1769E0]" /></td>
                      <td className="py-2 px-3"><button onClick={() => removeComp(c.id)} disabled={comps.length === 1} className="p-1.5 text-[#44474d] hover:text-[#F04438] disabled:opacity-30 transition-colors rounded"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-headline-sm text-[#111c2d]">Delivery Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block font-label-sm text-[#44474d] mb-1.5">Delivery Location</label>
                <input type="text" value={delivery.location} onChange={(e) => setDelivery((d) => ({ ...d, location: e.target.value }))} placeholder="City, State" className={INPUT_CLS} />
              </div>
              <div>
                <label className="block font-label-sm text-[#44474d] mb-1.5">Required Date</label>
                <input type="date" value={delivery.requiredDate} onChange={(e) => setDelivery((d) => ({ ...d, requiredDate: e.target.value }))} className={INPUT_CLS} />
              </div>
              <div>
                <label className="block font-label-sm text-[#44474d] mb-1.5">Priority</label>
                <select value={delivery.priority} onChange={(e) => setDelivery((d) => ({ ...d, priority: e.target.value }))} className={INPUT_CLS}>
                  <option value="low">Low</option>
                  <option value="standard">Standard</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block font-label-sm text-[#44474d] mb-1.5">Additional Requirements</label>
                <textarea value={delivery.notes} onChange={(e) => setDelivery((d) => ({ ...d, notes: e.target.value }))} rows={4} placeholder="Certifications, special requirements, or notes..." className="w-full px-3 py-2.5 border border-[#E4E7EC] rounded font-body-md text-[#111c2d] focus:outline-none focus:border-[#1769E0] resize-none" />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="font-headline-sm text-[#111c2d]">Review RFQ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#f9f9ff] rounded-lg p-4">
                <h3 className="font-label-sm text-[#44474d] uppercase tracking-wider text-xs mb-3">Company</h3>
                <div className="space-y-2">
                  {[{ k: "Company", v: req.company }, { k: "Contact", v: req.contact }, { k: "Email", v: req.email }, { k: "Phone", v: req.phone }, { k: "GSTIN", v: req.gstin }]
                    .filter((r) => r.v)
                    .map((r) => (
                      <div key={r.k} className="flex gap-2 font-body-sm">
                        <span className="text-[#44474d] w-20 shrink-0">{r.k}:</span>
                        <span className="text-[#111c2d]">{r.v}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="bg-[#f9f9ff] rounded-lg p-4">
                <h3 className="font-label-sm text-[#44474d] uppercase tracking-wider text-xs mb-3">Delivery</h3>
                <div className="space-y-2">
                  {[{ k: "Location", v: delivery.location }, { k: "Date", v: delivery.requiredDate }, { k: "Priority", v: delivery.priority }]
                    .filter((r) => r.v)
                    .map((r) => (
                      <div key={r.k} className="flex gap-2 font-body-sm">
                        <span className="text-[#44474d] w-20 shrink-0">{r.k}:</span>
                        <span className="text-[#111c2d] capitalize">{r.v}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
            {bomFile && (
              <div className="bg-[#f0f3ff] border border-[#1769E0]/30 rounded p-3 font-body-sm text-[#0B1F3A]">
                BOM file: <strong>{bomFile.name}</strong>
              </div>
            )}
            <div>
              <h3 className="font-label-sm text-[#44474d] uppercase tracking-wider text-xs mb-3">Components ({comps.filter((c) => c.mpn).length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="bg-[#f0f3ff]">
                      {["Part Number", "Manufacturer", "Qty", "Target Price"].map((h) => (
                        <th key={h} className="py-2 px-4 text-left font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7EC]">
                    {comps.filter((c) => c.mpn).map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 px-4 font-mono-label text-[#0B1F3A]">{c.mpn}</td>
                        <td className="py-2.5 px-4 font-body-sm text-[#111c2d]">{c.manufacturer}</td>
                        <td className="py-2.5 px-4 font-mono-label text-[#111c2d]">{c.quantity}</td>
                        <td className="py-2.5 px-4 font-mono-label text-[#111c2d]">{c.targetPrice ? `$${c.targetPrice}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2">{submitError}</p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col items-center text-center gap-6 py-8">
            <div className="w-20 h-20 rounded-full bg-[#12B76A]/10 flex items-center justify-center">
              <CheckCircle size={40} className="text-[#12B76A]" />
            </div>
            <div>
              <h2 className="font-headline-md text-[#111c2d]">RFQ Submitted Successfully</h2>
              <p className="font-body-md text-[#44474d] mt-2">Your RFQ has been submitted. Our team will review and respond within 24 hours.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/portal/rfqs" className="bg-[#0B1F3A] text-white px-6 py-2.5 rounded font-label-md hover:bg-[#1a3357] transition-colors">View My RFQs</Link>
              {submittedRfqId && (
                <Link href={`/portal/rfqs/${submittedRfqId}`} className="border border-[#E4E7EC] text-[#44474d] px-6 py-2.5 rounded font-label-md hover:bg-[#f0f3ff] transition-colors">View RFQ</Link>
              )}
            </div>
          </div>
        )}
      </div>

      {step < 5 && (
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            {step > 1 && (
              <button onClick={back} className="flex items-center gap-2 px-4 py-2 border border-[#E4E7EC] text-[#44474d] rounded font-label-md hover:bg-[#f0f3ff] transition-colors">
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <Link href="/portal/rfqs" className="px-4 py-2 text-[#44474d] font-label-md hover:text-[#111c2d] transition-colors">Cancel</Link>
          </div>
          <div className="flex gap-3">
            {step < 4 ? (
              <button onClick={next} className="flex items-center gap-2 bg-[#0B1F3A] text-white px-6 py-2 rounded font-label-md hover:bg-[#1a3357] transition-colors">
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 bg-[#0B1F3A] text-white px-6 py-2 rounded font-label-md hover:bg-[#1a3357] transition-colors disabled:opacity-60">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <>Submit RFQ <ChevronRight size={16} /></>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
