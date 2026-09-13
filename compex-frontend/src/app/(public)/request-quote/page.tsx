"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Plus, Trash2, CheckCircle, FileSpreadsheet, X, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { submitPublicLead, getBomCapability, uploadLeadBom, getLeadBomStatus } from "@/lib/api/leads";

interface BOMItem {
  mpn: string;
  manufacturer: string;
  description: string;
  quantity: string;
}

const defaultItems: BOMItem[] = [{ mpn: "", manufacturer: "", description: "", quantity: "" }];

const ALLOWED_EXTS = [".xlsx", ".csv"];
const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateBomFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) return "Only .xlsx and .csv files are supported.";
  if (file.size > MAX_BYTES) return "File exceeds the 10 MB limit.";
  return null;
}

type BomUploadState = "idle" | "uploading" | "processing" | "completed" | "failed" | "timeout";

export default function RequestQuotePage() {
  const [items, setItems] = useState<BOMItem[]>(defaultItems);
  const [activeTab, setActiveTab] = useState<"manual" | "bom">("manual");
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const submissionKey = useRef<string | undefined>(undefined);
  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    gstin: "",
    city: "",
    requiredDate: "",
    notes: "",
  });

  // BOM upload -- pre-submit file selection, driven by a real capability
  // check (never a hardcoded claim), plus post-submit upload/processing state.
  const [bomCapability, setBomCapability] = useState<boolean | null>(null);
  const [bomFile, setBomFile] = useState<File | null>(null);
  const [bomFileError, setBomFileError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [bomLeadId, setBomLeadId] = useState<string | null>(null);
  const [bomUploadState, setBomUploadState] = useState<BomUploadState>("idle");
  const [bomUploadError, setBomUploadError] = useState<string | null>(null);
  const [bomValidItemCount, setBomValidItemCount] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "bom") {
      queueMicrotask(() => setActiveTab("bom"));
    }
    const mpn = params.get("mpn");
    if (mpn) {
      const manufacturer = params.get("manufacturer") ?? "";
      queueMicrotask(() => setItems([{ mpn, manufacturer, description: "", quantity: "1" }]));
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "bom" || bomCapability !== null) return;
    let cancelled = false;
    getBomCapability()
      .then((res) => { if (!cancelled) setBomCapability(res.available); })
      .catch(() => { if (!cancelled) setBomCapability(false); });
    return () => { cancelled = true; };
  }, [activeTab, bomCapability]);

  const selectBomFile = (file: File) => {
    const error = validateBomFile(file);
    if (error) {
      setBomFileError(error);
      setBomFile(null);
      return;
    }
    setBomFileError(null);
    setBomFile(file);
  };

  const uploadAndTrackBom = async (leadId: string, file: File) => {
    setBomUploadState("uploading");
    setBomUploadError(null);
    try {
      const uploadResult = await uploadLeadBom(leadId, file);
      if (uploadResult.processingStatus === "COMPLETED") {
        setBomUploadState("completed");
        setBomValidItemCount(uploadResult.validItemCount);
        return;
      }
      if (uploadResult.processingStatus === "FAILED") {
        setBomUploadState("failed");
        setBomUploadError(uploadResult.processingError ?? "The BOM file could not be processed.");
        return;
      }
      setBomUploadState("processing");
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const status = await getLeadBomStatus(leadId);
        if (status.processingStatus === "COMPLETED") {
          setBomUploadState("completed");
          setBomValidItemCount(status.validItemCount);
          return;
        }
        if (status.processingStatus === "FAILED") {
          setBomUploadState("failed");
          setBomUploadError(status.processingError ?? "The BOM file could not be processed.");
          return;
        }
      }
      setBomUploadState("timeout");
    } catch {
      setBomUploadState("failed");
      setBomUploadError("We could not upload your BOM file. Please try again.");
    }
  };

  const retryBomUpload = (file: File) => {
    const error = validateBomFile(file);
    if (error) {
      setBomUploadError(error);
      return;
    }
    if (!bomLeadId) return;
    void uploadAndTrackBom(bomLeadId, file);
  };

  const addItem = () => setItems([...items, { mpn: "", manufacturer: "", description: "", quantity: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof BOMItem, val: string) =>
    setItems(items.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items
      .filter((item) => item.mpn.trim() && item.quantity)
      .map((item) => ({
        mpn: item.mpn.trim(),
        manufacturer: item.manufacturer.trim() || undefined,
        description: item.description.trim() || undefined,
        quantity: Number(item.quantity),
      }));
    if (activeTab === "manual" && (!validItems.length || validItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1))) {
      setSubmitError("Add at least one component with a valid quantity.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      submissionKey.current ??= crypto.randomUUID();
      const result = await submitPublicLead({
        source: activeTab === "bom" ? "BOM" : "REQUEST_QUOTE",
        contactName: form.contactPerson,
        contactEmail: form.email,
        contactPhone: form.phone || undefined,
        companyName: form.companyName,
        subject: activeTab === "bom" ? "BOM procurement enquiry" : "Component quote enquiry",
        message: [form.notes.trim(), form.gstin.trim() && `GSTIN: ${form.gstin.trim()}`].filter(Boolean).join("\n") || "Website quote enquiry",
        deliveryLocation: form.city,
        requiredDate: form.requiredDate || undefined,
        items: activeTab === "manual" ? validItems : [],
        website,
      }, submissionKey.current);
      setSubmittedReference(result.referenceNumber);
      if (activeTab === "bom" && bomFile) {
        setBomLeadId(result.id);
        void uploadAndTrackBom(result.id, bomFile);
      }
    } catch {
      setSubmitError("We could not submit your enquiry. Please try again shortly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedReference) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-[#1769E0]/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-[#1769E0]" />
        </div>
        <h1 className="font-headline-lg text-[#0B1F3A] mb-4">Enquiry Received</h1>
        <p className="font-body-md text-[#44474d] max-w-md mx-auto mb-8">
          Your enquiry has been saved with reference <strong>{submittedReference}</strong>. Sales will review it and contact you; sign in only if you need portal tracking.
        </p>

        {bomLeadId && (
          <div className="max-w-md mx-auto mb-8 text-left rounded-lg border border-[#E4E7EC] bg-white p-5">
            {(bomUploadState === "uploading" || bomUploadState === "processing") && (
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="text-[#1769E0] animate-spin shrink-0" />
                <p className="font-body-sm text-[#44474d]">
                  {bomUploadState === "uploading" ? "Uploading your BOM file…" : "Processing your BOM… this can take a moment."}
                </p>
              </div>
            )}
            {bomUploadState === "completed" && (
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className="text-[#12B76A] shrink-0" />
                <p className="font-body-sm text-[#111c2d]">
                  {typeof bomValidItemCount === "number"
                    ? `BOM processed — ${bomValidItemCount} component${bomValidItemCount === 1 ? "" : "s"} identified.`
                    : "BOM uploaded and processed."}
                </p>
              </div>
            )}
            {bomUploadState === "timeout" && (
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-[#B54708] shrink-0 mt-0.5" />
                <p className="font-body-sm text-[#44474d]">
                  Your BOM is still processing. Sales will follow up once it completes — no need to re-submit.
                </p>
              </div>
            )}
            {bomUploadState === "failed" && (
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle size={20} className="text-[#B42318] shrink-0 mt-0.5" />
                  <p className="font-body-sm text-[#B42318]">{bomUploadError}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-[#1769E0] font-label-md text-sm hover:underline cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) retryBomUpload(file);
                      e.target.value = "";
                    }}
                  />
                  Try a different file
                </label>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors">Back to Home</Link>
          <Link href="/login" className="inline-flex items-center gap-2 border border-[#1769E0] text-[#1769E0] px-6 py-3 rounded font-label-md hover:bg-[#e8eeff] transition-colors">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
      <div className="mb-8">
        <h1 className="font-headline-lg text-[#0B1F3A] mb-2">Request a Quote</h1>
        <p className="font-body-md text-[#44474d]">Submit your component requirements and our team will provide a detailed quotation.</p>
      </div>

      <div className="mb-6 rounded-lg border border-[#B9D4FF] bg-[#F0F6FF] px-4 py-3 font-body-sm text-[#173B67]">
        This public form records a sales enquiry, not a customer-portal RFQ. Sales will review the request and contact you with the next steps.
      </div>

      <form onSubmit={handleSubmit}>
        <input
          aria-hidden="true"
          autoComplete="off"
          className="hidden"
          name="website"
          tabIndex={-1}
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left — components */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tab toggle */}
            <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
              <div className="flex rounded-lg border border-[#E4E7EC] p-1 mb-6 w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab("manual")}
                  className={`px-5 py-2 rounded font-label-md text-sm transition-colors ${activeTab === "manual" ? "bg-[#0B1F3A] text-white" : "text-[#44474d] hover:text-[#111c2d]"}`}
                >
                  Manual Entry
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("bom")}
                  className={`px-5 py-2 rounded font-label-md text-sm transition-colors ${activeTab === "bom" ? "bg-[#0B1F3A] text-white" : "text-[#44474d] hover:text-[#111c2d]"}`}
                >
                  BOM Enquiry
                </button>
              </div>

              {activeTab === "manual" && (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="bg-[#f0f3ff]">
                          <th className="py-2 px-3 text-left font-label-sm text-[#44474d] uppercase tracking-wider">#</th>
                          <th className="py-2 px-3 text-left font-label-sm text-[#44474d] uppercase tracking-wider">MPN *</th>
                          <th className="py-2 px-3 text-left font-label-sm text-[#44474d] uppercase tracking-wider">Manufacturer</th>
                          <th className="py-2 px-3 text-left font-label-sm text-[#44474d] uppercase tracking-wider">Description</th>
                          <th className="py-2 px-3 text-left font-label-sm text-[#44474d] uppercase tracking-wider">Qty *</th>
                          <th className="py-2 px-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E7EC]">
                        {items.map((item, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 font-body-sm text-[#44474d]">{i + 1}</td>
                            <td className="py-2 px-3">
                              <input
                                aria-label={`Part number for line ${i + 1}`}
                                value={item.mpn}
                                onChange={(e) => updateItem(i, "mpn", e.target.value)}
                                className="w-full border border-[#E4E7EC] rounded px-2 py-1.5 font-mono-label text-sm focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
                                placeholder="e.g. STM32F103C8T6"
                                required
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                aria-label={`Manufacturer for line ${i + 1}`}
                                value={item.manufacturer}
                                onChange={(e) => updateItem(i, "manufacturer", e.target.value)}
                                className="w-full border border-[#E4E7EC] rounded px-2 py-1.5 font-body-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
                                placeholder="Manufacturer"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                aria-label={`Description for line ${i + 1}`}
                                value={item.description}
                                onChange={(e) => updateItem(i, "description", e.target.value)}
                                className="w-full border border-[#E4E7EC] rounded px-2 py-1.5 font-body-sm text-sm focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
                                placeholder="Description"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                aria-label={`Quantity for line ${i + 1}`}
                                value={item.quantity}
                                onChange={(e) => updateItem(i, "quantity", e.target.value)}
                                type="number"
                                min="1"
                                className="w-24 border border-[#E4E7EC] rounded px-2 py-1.5 font-mono-label text-sm focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
                                placeholder="Qty"
                                required
                              />
                            </td>
                            <td className="py-2 px-3">
                              {items.length > 1 && (
                                <button type="button" aria-label={`Remove component line ${i + 1}`} onClick={() => removeItem(i)} className="text-[#F04438] hover:text-[#F04438]/70 p-1">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-2 text-[#1769E0] font-label-md text-sm hover:underline"
                  >
                    <Plus size={16} /> Add Another Component
                  </button>
                </div>
              )}

              {activeTab === "bom" && (
                <div className="space-y-3">
                  {bomCapability === false && (
                    <div className="rounded-lg border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 font-body-sm text-[#93370D]">
                      Secure file upload is temporarily unavailable. You can still send your BOM enquiry now — sales will follow up with a secure upload or sign-in path.
                    </div>
                  )}

                  {bomFile ? (
                    <div className="flex items-center gap-3 rounded-lg border border-[#E4E7EC] p-4">
                      <FileSpreadsheet size={28} className="text-[#1769E0] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-label-md text-[#111c2d] truncate">{bomFile.name}</p>
                        <p className="font-body-sm text-[#44474d]">{formatBytes(bomFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove selected file"
                        onClick={() => { setBomFile(null); setBomFileError(null); }}
                        className="text-[#44474d] hover:text-[#F04438] p-1"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => { if (bomCapability) { e.preventDefault(); setIsDraggingOver(true); } }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        if (!bomCapability) return;
                        const file = e.dataTransfer.files?.[0];
                        if (file) selectBomFile(file);
                      }}
                      onClick={() => bomCapability && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                        bomCapability ? "cursor-pointer hover:border-[#1769E0]" : "opacity-60"
                      } ${isDraggingOver ? "border-[#1769E0] bg-[#F0F6FF]" : "border-[#E4E7EC]"}`}
                    >
                      <Upload size={40} className="text-[#44474d] mx-auto mb-4" />
                      <h3 className="font-headline-sm text-[#0B1F3A] mb-2">Secure BOM Upload</h3>
                      <p className="font-body-sm text-[#44474d] max-w-lg mx-auto">
                        {bomCapability === null
                          ? "Checking upload availability…"
                          : bomCapability
                            ? "Click to browse or drag and drop your .xlsx or .csv file (max 10 MB)."
                            : "Optional — attach a file once upload is available, or send your enquiry now."}
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.csv"
                        disabled={!bomCapability}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) selectBomFile(file);
                        }}
                      />
                    </div>
                  )}

                  {bomFileError && (
                    <p className="font-body-sm text-[#B42318]" role="alert">{bomFileError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Company details */}
            <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
              <h2 className="font-headline-sm text-[#0B1F3A] mb-6">Company Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Company Name *", name: "companyName", type: "text", placeholder: "Your Company Pvt. Ltd.", required: true },
                  { label: "Contact Person *", name: "contactPerson", type: "text", placeholder: "Full Name", required: true },
                  { label: "Business Email *", name: "email", type: "email", placeholder: "procurement@company.in", required: true },
                  { label: "Phone *", name: "phone", type: "tel", placeholder: "+91 98765 43210", required: true },
                  { label: "GSTIN", name: "gstin", type: "text", placeholder: "27AABCT1234H1Z5" },
                  { label: "Delivery City *", name: "city", type: "text", placeholder: "Mumbai, Pune, Bangalore...", required: true },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="block font-label-md text-[#44474d] mb-1.5">{field.label}</label>
                    <input
                      aria-label={field.label.replace(" *", "")}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={form[field.name as keyof typeof form]}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                      required={field.required}
                      className="w-full bg-[#f9f9ff] border border-[#E4E7EC] rounded px-4 py-3 font-body-md text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0] focus:border-[#1769E0]"
                    />
                  </div>
                ))}
                <div>
                  <label className="block font-label-md text-[#44474d] mb-1.5">Required Date</label>
                  <input
                    aria-label="Required date"
                    type="date"
                    value={form.requiredDate}
                    onChange={(e) => setForm({ ...form, requiredDate: e.target.value })}
                    className="w-full bg-[#f9f9ff] border border-[#E4E7EC] rounded px-4 py-3 font-body-md text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0]"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block font-label-md text-[#44474d] mb-1.5">Additional Requirements</label>
                <textarea
                  aria-label="Additional requirements"
                  rows={4}
                  placeholder="Any special requirements, certifications, or notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-[#f9f9ff] border border-[#E4E7EC] rounded px-4 py-3 font-body-md text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Right — summary */}
          <div>
            <div className="bg-white rounded-lg border border-[#E4E7EC] p-6 sticky top-4">
              <h2 className="font-headline-sm text-[#0B1F3A] mb-4">RFQ Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-[#44474d]">Line Items</span>
                  <span className="font-label-md text-[#111c2d]">{items.filter(i => i.mpn).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-[#44474d]">Total Quantity</span>
                  <span className="font-mono-label text-[#111c2d]">
                    {items.reduce((sum, i) => sum + (parseInt(i.quantity) || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="bg-[#e8eeff] rounded p-3 mb-6">
                <p className="font-body-sm text-[#44474d]">
                  Expected response time: <strong className="text-[#0B1F3A]">2–3 business days</strong>
                </p>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#1769E0] text-white py-4 rounded font-label-md font-bold hover:bg-[#1257b8] transition-colors"
              >
                {isSubmitting ? "Sending…" : activeTab === "bom" ? "Send BOM Enquiry" : "Submit Quote Enquiry"}
              </button>
              {submitError && <p className="mt-3 font-body-sm text-[#B42318]" role="alert">{submitError}</p>}
              <p className="font-body-sm text-[#44474d]/70 text-center mt-3">
                No commitment. Free quotation service.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
