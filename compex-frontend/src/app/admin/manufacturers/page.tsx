"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { Factory, Loader2, Search, Plus, X } from "lucide-react";
import { listManufacturers, createManufacturer, updateManufacturer, deactivateManufacturer, activateManufacturer, type Manufacturer, type ManufacturerInput } from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/error-message";
import { createPayload, updatePayload } from "@/lib/api/form-payload";
import { Field } from "@/components/admin/Field";

const emptyForm: ManufacturerInput = { name: "", slug: "" };

function formFor(m: Manufacturer): ManufacturerInput {
  return {
    name: m.name, slug: m.slug, logoUrl: m.logoUrl ?? "", website: m.website ?? "", description: m.description ?? "",
    country: m.country ?? "", sourceUrl: m.sourceUrl ?? "", distributorLink: m.distributorLink ?? "",
    stockCheckLink: m.stockCheckLink ?? "", acquiredMfr: m.acquiredMfr ?? "", remarks: m.remarks ?? "",
    suffixInformation: m.suffixInformation ?? "",
  };
}

const PAGE_SIZE = 48;

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function AdminManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [form, setForm] = useState<ManufacturerInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  // Only the newest request may write state, so a slow earlier search (or a
  // reload racing a debounced one) can never overwrite fresher results.
  const latestRequest = useRef(0);
  const load = useCallback(() => {
    const request = ++latestRequest.current;
    setLoading(true);
    listManufacturers({ search: search || undefined, page, limit: PAGE_SIZE })
      .then((result) => { if (request === latestRequest.current) { setManufacturers(result.data); setTotal(result.total); setError(null); } })
      .catch(() => { if (request === latestRequest.current) setError("Failed to load manufacturers."); })
      .finally(() => { if (request === latestRequest.current) setLoading(false); });
  }, [search, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  function openCreate() { setEditing(null); setForm(emptyForm); setFormError(null); setShowModal(true); }
  function openEdit(m: Manufacturer) { setEditing(m); setForm(formFor(m)); setFormError(null); setShowModal(true); }
  function close() { setShowModal(false); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // Update sends only changed fields (null = cleared); create omits blanks.
      if (editing) await updateManufacturer(editing.id, updatePayload(form, formFor(editing)));
      else await createManufacturer(createPayload(form));
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Failed to save manufacturer."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: Manufacturer) {
    setError(null);
    try {
      await (m.isActive ? deactivateManufacturer(m.id) : activateManufacturer(m.id));
      load();
    } catch (err) {
      setError(apiErrorMessage(err, `Failed to ${m.isActive ? "deactivate" : "activate"} ${m.name}.`));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div><h1 className="font-headline-lg text-[#111c2d]">Manufacturers</h1><p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${total} live manufacturer records`}</p></div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90">
          <Plus size={15} /> Add Manufacturer
        </button>
      </div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search manufacturers" placeholder="Search name or slug…" className="w-full rounded border border-[#E4E7EC] bg-white py-2.5 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></div>
      {error && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-sm">
        {loading ? <div className="flex items-center justify-center py-16 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={20} /> Loading manufacturers…</div> :
          manufacturers.length === 0 ? <p className="py-16 text-center text-[#667085]">No manufacturers found.</p> :
          <div className="grid grid-cols-1 divide-y divide-[#E4E7EC] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
            {manufacturers.map((m) => (
              <article key={m.id} className="p-5 group relative">
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded-lg bg-[#e8eeff] p-2 text-[#1769E0]"><Factory size={18} /></span>
                  <div>
                    <h2 className="font-label-md text-[#111c2d]">{m.name}</h2>
                    <p className="font-mono text-xs text-[#667085]">{m.slug}</p>
                  </div>
                  <span className={`ml-auto font-label-sm text-xs ${m.isActive ? "text-[#12B76A]" : "text-[#F04438]"}`}>{m.isActive ? "Active" : "Inactive"}</span>
                </div>
                {m.website ? <a href={m.website} target="_blank" rel="noreferrer" className="font-body-sm text-[#1769E0] hover:underline">Open website</a> : <p className="font-body-sm text-[#667085]">No website recorded</p>}
                <div className="mt-3 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(m)} className="font-label-sm text-[#1769E0] hover:underline text-xs">Edit</button>
                  <button onClick={() => toggleActive(m)} className="font-label-sm text-[#F04438] hover:underline text-xs">{m.isActive ? "Deactivate" : "Activate"}</button>
                </div>
              </article>
            ))}
          </div>}
      </div>

      {total > PAGE_SIZE && (
        <nav aria-label="Manufacturer pages" className="flex items-center justify-between text-sm text-[#44474d]">
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="rounded border border-[#E4E7EC] px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE) || loading} className="rounded border border-[#E4E7EC] px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </nav>
      )}

      {showModal && (
        <div role="dialog" aria-modal="true" aria-label={editing ? "Edit manufacturer" : "Add manufacturer"} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E7EC]">
              <h2 className="font-headline-sm text-[#111c2d]">{editing ? "Edit Manufacturer" : "Add Manufacturer"}</h2>
              <button onClick={close} className="text-[#44474d] hover:text-[#111c2d]"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              {formError && <p role="alert" className="font-body-sm text-[#B42318]">{formError}</p>}
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Manufacturer name *"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v, slug: editing ? f.slug : slugify(v) }))}
                  required
                />
                <Field label="Slug *" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} required />
                <Field label="Website" value={form.website ?? ""} onChange={(v) => setForm({ ...form, website: v })} />
                <Field label="Country" value={form.country ?? ""} onChange={(v) => setForm({ ...form, country: v })} />
                <Field label="Manufacturer image (logo URL)" value={form.logoUrl ?? ""} onChange={(v) => setForm({ ...form, logoUrl: v })} />
                <Field label="Distributor link" value={form.distributorLink ?? ""} onChange={(v) => setForm({ ...form, distributorLink: v })} />
                <Field label="Stock-check link" value={form.stockCheckLink ?? ""} onChange={(v) => setForm({ ...form, stockCheckLink: v })} />
                <Field label="Suffix information" value={form.suffixInformation ?? ""} onChange={(v) => setForm({ ...form, suffixInformation: v })} />
              </div>
              <Field label="Description" value={form.description ?? ""} onChange={(v) => setForm({ ...form, description: v })} textarea />
              <Field label="Acquired manufacturer information" value={form.acquiredMfr ?? ""} onChange={(v) => setForm({ ...form, acquiredMfr: v })} textarea />
              <Field label="Remarks" value={form.remarks ?? ""} onChange={(v) => setForm({ ...form, remarks: v })} textarea />
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
