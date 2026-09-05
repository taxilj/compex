"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Package, X } from "lucide-react";
import {
  listAdminProducts,
  createProduct,
  updateProduct,
  listManufacturers,
  listAdminCategories,
  type AdminProduct,
  type AdminProductInput,
  type Manufacturer,
  type AdminCategory,
} from "@/lib/api/admin";

const importStatusBadge: Record<string, string> = {
  MANUAL: "bg-[#44474d]/10 text-[#44474d]",
  IMPORTED: "bg-[#12B76A]/10 text-[#12B76A]",
  PENDING: "bg-[#F79009]/10 text-[#F79009]",
  FAILED: "bg-[#F04438]/10 text-[#F04438]",
};

const emptyForm: AdminProductInput = { mpn: "", name: "", description: "", packageType: "", lifecycleStatus: "", datasheetUrl: "" };

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<AdminProductInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAdminProducts({ q: search || undefined, categoryId: categoryId || undefined, limit: 100 })
      .then((r) => { setProducts(r.data); setTotal(r.total); })
      .catch(() => setError("Failed to load products."))
      .finally(() => setLoading(false));
  }, [search, categoryId]);

  useEffect(() => { queueMicrotask(() => load()); }, [load]);

  useEffect(() => {
    listManufacturers().then((r) => setManufacturers(r.data)).catch(() => {});
    listAdminCategories().then(setCategories).catch(() => {});
  }, []);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (p: AdminProduct) => {
    setEditing(p);
    setForm({
      mpn: p.mpn,
      name: p.name ?? "",
      description: p.description ?? "",
      manufacturerId: p.manufacturerId ?? undefined,
      categoryId: p.categoryId ?? undefined,
      packageType: p.packageType ?? "",
      lifecycleStatus: p.lifecycleStatus ?? "",
      datasheetUrl: p.datasheetUrl ?? "",
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleClose = () => setShowModal(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload: AdminProductInput = {
        ...form,
        name: form.name || undefined,
        description: form.description || undefined,
        packageType: form.packageType || undefined,
        lifecycleStatus: form.lifecycleStatus || undefined,
        datasheetUrl: form.datasheetUrl || undefined,
      };
      if (editing) await updateProduct(editing.id, payload);
      else await createProduct(payload);
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: AdminProduct) => {
    await updateProduct(p.id, { isActive: !p.isActive });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Product Catalog</h1>
          <p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${total} products`}</p>
        </div>
        <button onClick={handleOpenCreate} className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90">
          <Plus size={15} /> Add Product
        </button>
      </div>

      {error && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>}

      <div className="bg-[#f0f3ff] rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search MPN, name, or description..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="px-3 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                {["MPN", "Manufacturer", "Category", "Package", "Lifecycle", "Import", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#f0f3ff] rounded flex items-center justify-center shrink-0">
                        <Package size={14} className="text-[#0B1F3A]/40" />
                      </div>
                      <div>
                        <p className="font-mono-label text-[#0B1F3A] font-medium text-sm">{p.mpn}</p>
                        <p className="font-body-sm text-[#44474d] text-xs truncate max-w-[200px]">{p.name ?? p.description ?? ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{p.manufacturer?.name ?? "—"}</td>
                  <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{p.category?.name ?? "—"}</td>
                  <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{p.packageType ?? "—"}</td>
                  <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{p.lifecycleStatus ?? "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-xs ${importStatusBadge[p.importStatus] ?? "bg-[#44474d]/10 text-[#44474d]"}`}>
                      {p.importStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`font-label-sm text-xs ${p.isActive ? "text-[#12B76A]" : "text-[#F04438]"}`}>{p.isActive ? "Active" : "Hidden"}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenEdit(p)} className="font-label-sm text-[#1769E0] hover:underline text-xs">Edit</button>
                      <button onClick={() => toggleActive(p)} className="font-label-sm text-[#F04438] hover:underline text-xs">{p.isActive ? "Hide" : "Unhide"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && products.length === 0 && <p className="py-16 text-center text-[#667085]">No products found.</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleClose}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E7EC]">
              <h2 className="font-headline-sm text-[#111c2d]">{editing ? "Edit Product" : "Add Product"}</h2>
              <button onClick={handleClose} className="text-[#44474d] hover:text-[#111c2d]"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <p role="alert" className="font-body-sm text-[#B42318]">{formError}</p>}
              <Field label="MPN *" value={form.mpn} onChange={(v) => setForm({ ...form, mpn: v })} required disabled={!!editing} />
              <Field label="Name" value={form.name ?? ""} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Description" value={form.description ?? ""} onChange={(v) => setForm({ ...form, description: v })} textarea />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Manufacturer</label>
                  <select value={form.manufacturerId ?? ""} onChange={(e) => setForm({ ...form, manufacturerId: e.target.value || undefined })} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
                    <option value="">—</option>
                    {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Category</label>
                  <select value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value || undefined })} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
                    <option value="">—</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Package Type" value={form.packageType ?? ""} onChange={(v) => setForm({ ...form, packageType: v })} />
                <Field label="Lifecycle Status" value={form.lifecycleStatus ?? ""} onChange={(v) => setForm({ ...form, lifecycleStatus: v })} />
              </div>
              <Field label="Datasheet URL" value={form.datasheetUrl ?? ""} onChange={(v) => setForm({ ...form, datasheetUrl: v })} />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleClose} className="px-4 py-2 rounded border border-[#E4E7EC] font-label-md text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-[#0B1F3A] text-white font-label-md text-sm disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, required, disabled, textarea }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; disabled?: boolean; textarea?: boolean }) {
  return (
    <div>
      <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} rows={3} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm disabled:bg-[#f9f9ff]" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm disabled:bg-[#f9f9ff]" />
      )}
    </div>
  );
}
