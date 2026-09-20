"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, Plus, X } from "lucide-react";
import { listVendors, createVendor, updateVendor, deactivateVendor, activateVendor, type Vendor, type VendorInput } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/error-message";
import { createPayload, updatePayload } from "@/lib/api/form-payload";
import { Field } from "@/components/admin/Field";
import { SettingsSelect } from "@/components/admin/SettingsSelect";

const emptyForm: VendorInput = { name: "", contactEmail: "" };

function formFor(v: Vendor): VendorInput {
  return {
    name: v.name, contactEmail: v.contactEmail, contactPhone: v.contactPhone ?? "", address: v.address ?? "", notes: v.notes ?? "",
    contactName: v.contactName ?? "", vendorCode: v.vendorCode ?? "", billToAddress: v.billToAddress ?? "", shipToAddress: v.shipToAddress ?? "",
    country: v.country ?? "", telephone: v.telephone ?? "", fax: v.fax ?? "", mobile: v.mobile ?? "", website: v.website ?? "",
    otherOffices: v.otherOffices ?? "", mov: v.mov ? Number(v.mov) : null, paymentCurrency: v.paymentCurrency ?? "",
    paymentTerms: v.paymentTerms ?? "", shippingAccount: v.shippingAccount ?? "", bankDetails: v.bankDetails ?? "",
    creditLimit: v.creditLimit ? Number(v.creditLimit) : null, industrySegment: v.industrySegment ?? "",
    businessType: v.businessType ?? "", speciality: v.speciality ?? "", gstOrRegistrationNumber: v.gstOrRegistrationNumber ?? "",
  };
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Only the newest request may write state, so a slow earlier search (or a
  // reload racing a debounced one) can never overwrite fresher results.
  const latestRequest = useRef(0);
  const load = useCallback(() => {
    const request = ++latestRequest.current;
    setLoading(true);
    listVendors({ search: search || undefined, limit: 100 })
      .then((res) => { if (request === latestRequest.current) { setVendors(res.data); setTotal(res.total); setError(null); } })
      .catch(() => { if (request === latestRequest.current) setError("Failed to load vendors."); })
      .finally(() => { if (request === latestRequest.current) setLoading(false); });
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  function openCreate() { setEditing(null); setForm(emptyForm); setFormError(null); setShowModal(true); }
  function openEdit(v: Vendor) { setEditing(v); setForm(formFor(v)); setFormError(null); setShowModal(true); }
  function close() { setShowModal(false); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // Update sends only changed fields (null = cleared); create omits blanks.
      if (editing) await updateVendor(editing.id, updatePayload(form, formFor(editing)));
      else await createVendor(createPayload(form));
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Failed to save vendor."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(v: Vendor) {
    setError(null);
    try {
      await (v.isActive ? deactivateVendor(v.id) : activateVendor(v.id));
      load();
    } catch (err) {
      setError(apiErrorMessage(err, `Failed to ${v.isActive ? "deactivate" : "activate"} ${v.name}.`));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Vendor Management</h1>
          <p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${total} vendor${total === 1 ? "" : "s"}`}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90">
          <Plus size={15} /> Add Vendor
        </button>
      </div>

      <div className="bg-[#e8eeff] rounded-lg p-5">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor, code, or email..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
        </div>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-[#44474d]"><Loader2 size={22} className="animate-spin mr-2" /> Loading vendors…</div>}
      {error && <p role="alert" className="text-[#F04438] font-body-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                  {["Vendor", "Code", "Email", "Phone", "Business type", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {vendors.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center font-body-md text-[#44474d]">No vendors found.</td></tr>
                ) : vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-[#0B1F3A]/10 flex items-center justify-center font-bold text-xs text-[#0B1F3A] shrink-0">{v.name.slice(0, 2).toUpperCase()}</div>
                        <span className="font-label-md text-[#111c2d] text-sm">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono-label text-[#44474d] text-sm">{v.vendorCode ?? "—"}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{v.contactEmail}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{v.contactPhone ?? v.telephone ?? "—"}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{v.businessType ?? "—"}</td>
                    <td className="px-5 py-4"><span className={`font-label-sm text-xs ${v.isActive ? "text-[#12B76A]" : "text-[#F04438]"}`}>{v.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(v)} className="font-label-sm text-[#1769E0] hover:underline text-xs">Edit</button>
                        <button onClick={() => toggleActive(v)} className="font-label-sm text-[#F04438] hover:underline text-xs">{v.isActive ? "Deactivate" : "Activate"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div role="dialog" aria-modal="true" aria-label={editing ? "Edit vendor" : "Add vendor"} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E7EC]">
              <h2 className="font-headline-sm text-[#111c2d]">{editing ? "Edit Vendor" : "Add Vendor"}</h2>
              <button onClick={close} className="text-[#44474d] hover:text-[#111c2d]"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              {formError && <p role="alert" className="font-body-sm text-[#B42318]">{formError}</p>}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Vendor name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
                <Field label="Vendor code" value={form.vendorCode ?? ""} onChange={(v) => setForm({ ...form, vendorCode: v })} />
                <Field label="Contact email *" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} required type="email" />
                <Field label="Contact name" value={form.contactName ?? ""} onChange={(v) => setForm({ ...form, contactName: v })} />
                <Field label="Telephone" value={form.telephone ?? ""} onChange={(v) => setForm({ ...form, telephone: v })} />
                <Field label="Mobile" value={form.mobile ?? ""} onChange={(v) => setForm({ ...form, mobile: v })} />
                <Field label="Fax" value={form.fax ?? ""} onChange={(v) => setForm({ ...form, fax: v })} />
                <Field label="Website" value={form.website ?? ""} onChange={(v) => setForm({ ...form, website: v })} />
                <SettingsSelect category="COUNTRY" label="Country" value={form.country ?? ""} onChange={(v) => setForm({ ...form, country: v })} />
                <Field label="GST / Registration number" value={form.gstOrRegistrationNumber ?? ""} onChange={(v) => setForm({ ...form, gstOrRegistrationNumber: v })} />
                <SettingsSelect category="BUSINESS_TYPE" label="Business type" value={form.businessType ?? ""} onChange={(v) => setForm({ ...form, businessType: v })} />
                <Field label="Speciality" value={form.speciality ?? ""} onChange={(v) => setForm({ ...form, speciality: v })} />
                <SettingsSelect category="INDUSTRY_SEGMENT" label="Industry segment" value={form.industrySegment ?? ""} onChange={(v) => setForm({ ...form, industrySegment: v })} />
                <SettingsSelect category="PAYMENT_TERMS" label="Payment terms" value={form.paymentTerms ?? ""} onChange={(v) => setForm({ ...form, paymentTerms: v })} />
                <SettingsSelect category="CURRENCY" label="Payment currency" value={form.paymentCurrency ?? ""} onChange={(v) => setForm({ ...form, paymentCurrency: v })} />
                <Field label="MOV" value={form.mov != null ? String(form.mov) : ""} onChange={(v) => setForm({ ...form, mov: v === "" ? null : Number(v) })} type="number" />
                <Field label="Credit limit" value={form.creditLimit != null ? String(form.creditLimit) : ""} onChange={(v) => setForm({ ...form, creditLimit: v === "" ? null : Number(v) })} type="number" />
                <Field label="Shipping account" value={form.shippingAccount ?? ""} onChange={(v) => setForm({ ...form, shippingAccount: v })} />
              </div>
              <Field label="Bill-to address" value={form.billToAddress ?? ""} onChange={(v) => setForm({ ...form, billToAddress: v })} textarea />
              <Field label="Ship-to address" value={form.shipToAddress ?? ""} onChange={(v) => setForm({ ...form, shipToAddress: v })} textarea />
              <Field label="Address" value={form.address ?? ""} onChange={(v) => setForm({ ...form, address: v })} textarea />
              <Field label="Other offices" value={form.otherOffices ?? ""} onChange={(v) => setForm({ ...form, otherOffices: v })} textarea />
              <Field label="Bank details" value={form.bankDetails ?? ""} onChange={(v) => setForm({ ...form, bankDetails: v })} textarea />
              <Field label="Notes" value={form.notes ?? ""} onChange={(v) => setForm({ ...form, notes: v })} textarea />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={close} className="px-4 py-2 rounded border border-[#E4E7EC] font-label-md text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-[#0B1F3A] text-white font-label-md text-sm disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
