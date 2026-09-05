"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, FolderTree, X } from "lucide-react";
import { listAdminCategories, createCategory, updateCategory, type AdminCategory } from "@/lib/api/admin";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState({ name: "", description: "", parentId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listAdminCategories()
      .then(setCategories)
      .catch(() => setError("Failed to load categories."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { queueMicrotask(() => load()); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", parentId: "" });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (c: AdminCategory) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? "", parentId: c.parentId ?? "" });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = { name: form.name, description: form.description || undefined, parentId: form.parentId || undefined };
      if (editing) await updateCategory(editing.id, payload);
      else await createCategory(payload);
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const topLevel = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Categories</h1>
          <p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${categories.length} categories`}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90">
          <Plus size={15} /> Add Category
        </button>
      </div>

      {error && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
        {!loading && topLevel.length === 0 ? (
          <p className="py-16 text-center text-[#667085]">No categories yet.</p>
        ) : (
          <div className="divide-y divide-[#E4E7EC]">
            {topLevel.map((c) => (
              <div key={c.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-[#e8eeff] p-2 text-[#1769E0]"><FolderTree size={16} /></span>
                    <div>
                      <p className="font-label-md text-[#111c2d]">{c.name}</p>
                      <p className="font-body-sm text-[#667085] text-xs">{c._count.products} products · {c._count.children} subcategories</p>
                    </div>
                  </div>
                  <button onClick={() => openEdit(c)} className="font-label-sm text-[#1769E0] hover:underline text-xs">Edit</button>
                </div>
                {childrenOf(c.id).length > 0 && (
                  <div className="mt-3 ml-11 space-y-2">
                    {childrenOf(c.id).map((child) => (
                      <div key={child.id} className="flex items-center justify-between">
                        <p className="font-body-sm text-[#44474d]">└ {child.name} <span className="text-[#667085] text-xs">({child._count.products} products)</span></p>
                        <button onClick={() => openEdit(child)} className="font-label-sm text-[#1769E0] hover:underline text-xs">Edit</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E7EC]">
              <h2 className="font-headline-sm text-[#111c2d]">{editing ? "Edit Category" : "Add Category"}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#44474d] hover:text-[#111c2d]"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <p role="alert" className="font-body-sm text-[#B42318]">{formError}</p>}
              <div>
                <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Parent Category</label>
                <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
                  <option value="">— Top level —</option>
                  {categories.filter((c) => c.id !== editing?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded border border-[#E4E7EC] font-label-md text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-[#0B1F3A] text-white font-label-md text-sm disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
