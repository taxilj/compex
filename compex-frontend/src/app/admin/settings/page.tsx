"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, Lock, Check, X } from "lucide-react";
import { listSettingCategories, listSettings, createSetting, updateSetting, deleteSetting, type Setting } from "@/lib/api/admin";

function formatCategoryLabel(category: string): string {
  return category.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

export default function AdminSettingsPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [values, setValues] = useState<Setting[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingValues, setLoadingValues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listSettingCategories()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) setActiveCategory(cats[0]);
      })
      .catch(() => setError("Failed to load setting categories."))
      .finally(() => setLoadingCategories(false));
  }, []);

  const loadValues = useCallback((category: string) => {
    setLoadingValues(true);
    setError(null);
    listSettings(category)
      .then(setValues)
      .catch(() => setError("Failed to load values for this category."))
      .finally(() => setLoadingValues(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- parameterized refetch on category change, not derivable state
    if (activeCategory) loadValues(activeCategory);
  }, [activeCategory, loadValues]);

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  async function handleAdd() {
    if (!activeCategory || !newValue.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createSetting({ category: activeCategory, value: newValue.trim(), sortOrder: values.length });
      setNewValue("");
      loadValues(activeCategory);
      flashSaved();
    } catch {
      setError("Failed to add value. It may already exist for this category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editingValue.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateSetting(id, { value: editingValue.trim() });
      setEditingId(null);
      if (activeCategory) loadValues(activeCategory);
      flashSaved();
    } catch {
      setError("Failed to save. This value may be read-only.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this setting value? This action cannot be undone.")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteSetting(id);
      if (activeCategory) loadValues(activeCategory);
      flashSaved();
    } catch {
      setError("Failed to delete. This value may be read-only.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Settings</h1>
          <p className="font-body-md text-[#44474d]">Manage list-of-values used across the platform.</p>
        </div>
        {savedFlash && (
          <span className="flex items-center gap-1.5 text-[#12B76A] font-label-sm text-sm">
            <Check size={16} /> Saved
          </span>
        )}
      </div>

      {error && (
        <div className="bg-[#FEF3F2] border border-[#F04438]/30 text-[#F04438] px-4 py-2.5 rounded-lg font-body-sm text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        <nav className="w-64 shrink-0 bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-2 max-h-[600px] overflow-y-auto">
          {loadingCategories ? (
            <div className="flex items-center justify-center py-8 text-[#44474d]">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : (
            <ul className="space-y-1">
              {categories.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-3 py-2 rounded-lg font-label-sm text-sm transition-colors ${activeCategory === cat ? "bg-[#f0f3ff] text-[#0B1F3A] font-medium" : "text-[#44474d] hover:bg-[#f0f3ff]/60"}`}
                  >
                    {formatCategoryLabel(cat)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <div className="flex-1 bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6 min-h-[400px]">
          {!activeCategory ? (
            <p className="font-body-md text-[#44474d]">Select a category.</p>
          ) : loadingValues ? (
            <div className="flex items-center justify-center py-16 text-[#44474d]">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading values…
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="font-label-lg text-[#111c2d] font-semibold">{formatCategoryLabel(activeCategory)}</h2>
              <ul className="divide-y divide-[#E4E7EC]">
                {values.length === 0 ? (
                  <li className="py-6 text-center font-body-sm text-[#44474d]">No values yet.</li>
                ) : values.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-3">
                    {editingId === s.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]"
                          autoFocus
                        />
                        <button onClick={() => handleSaveEdit(s.id)} disabled={saving} className="p-1.5 text-[#12B76A] hover:bg-[#12B76A]/10 rounded" aria-label="Save">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-[#44474d] hover:bg-[#f0f3ff] rounded" aria-label="Cancel">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-body-sm text-[#111c2d] text-sm">{s.value}</span>
                        {s.isEditable ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingId(s.id); setEditingValue(s.value); }}
                              className="px-2.5 py-1 font-label-sm text-xs text-[#1769E0] hover:bg-[#f0f3ff] rounded"
                            >
                              Edit
                            </button>
                            <button onClick={() => handleDelete(s.id)} disabled={saving} className="p-1.5 text-[#F04438] hover:bg-[#FEF3F2] rounded" aria-label="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 font-label-sm text-xs text-[#44474d]">
                            <Lock size={12} /> Read-only
                          </span>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-2 pt-2">
                <input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Add a new value…"
                  className="flex-1 px-3 py-2 bg-white border border-[#E4E7EC] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]"
                />
                <button
                  onClick={handleAdd}
                  disabled={saving || !newValue.trim()}
                  className="flex items-center gap-1.5 bg-[#0B1F3A] text-white px-3.5 py-2 rounded-lg font-label-sm text-sm hover:bg-[#0B1F3A]/90 transition-colors disabled:opacity-50"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
