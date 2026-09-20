"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { Field } from "@/components/admin/Field";
import { SettingsSelect } from "@/components/admin/SettingsSelect";
import { apiErrorMessage } from "@/lib/api/error-message";
import { createPayload, updatePayload } from "@/lib/api/form-payload";

const PAGE_SIZE = 50;

const importStatusBadge: Record<string, string> = {
  MANUAL: "bg-[#44474d]/10 text-[#44474d]",
  IMPORTED: "bg-[#12B76A]/10 text-[#12B76A]",
  PENDING: "bg-[#F79009]/10 text-[#F79009]",
  FAILED: "bg-[#F04438]/10 text-[#F04438]",
};

const emptyForm: AdminProductInput = { mpn: "", name: "", description: "", packageType: "", lifecycleStatus: "", datasheetUrl: "" };

function productForm(p: AdminProduct): AdminProductInput {
  return {
    mpn: p.mpn,
    name: p.name ?? "",
    description: p.description ?? "",
    manufacturerId: p.manufacturerId ?? null,
    categoryId: p.categoryId ?? null,
    packageType: p.packageType ?? "",
    lifecycleStatus: p.lifecycleStatus ?? "",
    datasheetUrl: p.datasheetUrl ?? "",
    productCode: p.productCode ?? "",
    spq: p.spq ?? null,
    packaging: p.packaging ?? "",
    uom: p.uom ?? "",
    hsCode: p.hsCode ?? "",
    hsDescription: p.hsDescription ?? "",
    productGroup: p.productGroup ?? "",
    eccn: p.eccn ?? "",
    availableStock: p.availableStock ?? null,
  };
}

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

  const [page, setPage] = useState(1);
  const [lookupWarning, setLookupWarning] = useState<string | null>(null);

  // Only the newest request may write state, so a slow earlier keystroke's
  // response can never overwrite the results for what's currently typed.
  const latestRequest = useRef(0);
  const load = useCallback(() => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(null);
    listAdminProducts({ q: search || undefined, categoryId: categoryId || undefined, page, limit: PAGE_SIZE })
      .then((r) => { if (request === latestRequest.current) { setProducts(r.data); setTotal(r.total); } })
      .catch(() => { if (request === latestRequest.current) setError("Failed to load products."); })
      .finally(() => { if (request === latestRequest.current) setLoading(false); });
  }, [search, categoryId, page]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    let active = true;
    listManufacturers({ limit: 100 }).then((r) => { if (active) setManufacturers(r.data); })
      .catch(() => { if (active) setLookupWarning("Couldn't load manufacturers; the Manufacturer dropdown may be incomplete."); });
    listAdminCategories().then((c) => { if (active) setCategories(c); })
      .catch(() => { if (active) setLookupWarning("Couldn't load categories; the Category dropdown may be incomplete."); });
    return () => { active = false; };
  }, []);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (p: AdminProduct) => {
    setEditing(p);
    setForm(productForm(p));
    setFormError(null);
    setShowModal(true);
  };

  const handleClose = () => setShowModal(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // Update sends only changed fields (null = cleared); create omits blanks.
      if (editing) await updateProduct(editing.id, updatePayload(form, productForm(editing)));
      else await createProduct(createPayload(form));
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Failed to save product"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: AdminProduct) => {
    setError(null);
    try {
      await updateProduct(p.id, { isActive: !p.isActive });
      load();
    } catch (err) {
      setError(apiErrorMessage(err, `Failed to ${p.isActive ? "hide" : "unhide"} ${p.mpn}.`));
    }
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
      {lookupWarning && <p role="status" className="rounded border border-[#F79009]/30 bg-[#FFFAEB] px-4 py-3 text-[#9A6700] text-sm">{lookupWarning}</p>}

      <div className="bg-[#f0f3ff] rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search MPN, name, or description..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
        </div>
        <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="px-3 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none">
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

      {total > PAGE_SIZE && (
        <nav aria-label="Product pages" className="flex items-center justify-between text-sm text-[#44474d]">
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="rounded border border-[#E4E7EC] px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE) || loading} className="rounded border border-[#E4E7EC] px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </nav>
      )}

      {showModal && (
        <div role="dialog" aria-modal="true" aria-label={editing ? "Edit product" : "Add product"} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleClose}>
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
                  <select value={form.manufacturerId ?? ""} onChange={(e) => setForm({ ...form, manufacturerId: e.target.value || null })} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
                    <option value="">—</option>
                    {editing?.manufacturer && form.manufacturerId === editing.manufacturer.id && !manufacturers.some((m) => m.id === editing.manufacturer!.id) && (
                      <option value={editing.manufacturer.id}>{editing.manufacturer.name}</option>
                    )}
                    {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Category</label>
                  <select value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value || null })} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
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
              <div className="grid grid-cols-2 gap-4">
                <Field label="Product code" value={form.productCode ?? ""} onChange={(v) => setForm({ ...form, productCode: v })} />
                <Field label="SPQ" value={form.spq != null ? String(form.spq) : ""} onChange={(v) => setForm({ ...form, spq: v === "" ? null : Number(v) })} />
                <Field label="Available stock" value={form.availableStock != null ? String(form.availableStock) : ""} onChange={(v) => setForm({ ...form, availableStock: v === "" ? null : Number(v) })} />
                <SettingsSelect category="PACKAGING" label="Packaging" value={form.packaging ?? ""} onChange={(v) => setForm({ ...form, packaging: v })} />
                <SettingsSelect category="UOM" label="UOM" value={form.uom ?? ""} onChange={(v) => setForm({ ...form, uom: v })} />
                <SettingsSelect category="PRODUCT_GROUP" label="Product group" value={form.productGroup ?? ""} onChange={(v) => setForm({ ...form, productGroup: v })} />
                <Field label="ECCN" value={form.eccn ?? ""} onChange={(v) => setForm({ ...form, eccn: v })} />
                <SettingsSelect category="HSN_CODE" label="HS code" value={form.hsCode ?? ""} onChange={(v) => setForm({ ...form, hsCode: v })} />
                <SettingsSelect category="SUB_CATEGORY_HS_DESC" label="HS description" value={form.hsDescription ?? ""} onChange={(v) => setForm({ ...form, hsDescription: v })} />
              </div>
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
