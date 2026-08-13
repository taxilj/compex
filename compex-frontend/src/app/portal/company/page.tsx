"use client";

import { useEffect, useState } from "react";
import { Save, Plus, Loader2 } from "lucide-react";
import { getMyCompany, updateMyCompany, type BackendCompany } from "@/lib/api/customers";
import { ApiError } from "@/lib/api/client";

type LocalState = {
  name: string;
  gstin: string;
  city: string;
  address: string;
};

export default function CompanyProfilePage() {
  const [company, setCompany] = useState<BackendCompany | null>(null);
  const [local, setLocal] = useState<LocalState>({ name: "", gstin: "", city: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getMyCompany()
      .then((c) => {
        setCompany(c);
        setLocal({ name: c.name, gstin: c.gstin ?? "", city: c.city ?? "", address: c.address ?? "" });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveError(null);
    try {
      const updated = await updateMyCompany({
        name: local.name || undefined,
        gstin: local.gstin || undefined,
        city: local.city || undefined,
        address: local.address || undefined,
      });
      setCompany(updated);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof ApiError ? err.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#44474d]">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading company profile…
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Company Profile</h1>
          <p className="font-body-md text-[#44474d] mt-1">Manage your company information and settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded font-label-md transition-colors disabled:opacity-60 ${
            saveStatus === "saved" ? "bg-[#12B76A] text-white"
            : saveStatus === "error" ? "bg-red-600 text-white"
            : "bg-[#0B1F3A] text-white hover:bg-[#0B1F3A]/90"
          }`}
        >
          <Save size={18} /> {saving ? "Saving…" : saveStatus === "saved" ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {saveError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-2">{saveError}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Company Information">
          <Field label="Company Name" value={local.name} onChange={(v) => setLocal({ ...local, name: v })} />
          <Field label="GSTIN" value={local.gstin} onChange={(v) => setLocal({ ...local, gstin: v })} />
          <Field label="City" value={local.city} onChange={(v) => setLocal({ ...local, city: v })} />
          <Field label="Address" value={local.address} onChange={(v) => setLocal({ ...local, address: v })} />
        </Section>

        <Section title="Contact Information">
          <Field label="Contact Person" value="" onChange={() => {}} disabled placeholder="Managed via user account" />
          <Field label="Email" value="" type="email" onChange={() => {}} disabled placeholder="Managed via user account" />
          <Field label="Phone" value="" type="tel" onChange={() => {}} disabled placeholder="Managed via user account" />
        </Section>

        <Section title="Billing Address">
          <Field label="Address" value={local.address} onChange={(v) => setLocal({ ...local, address: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={local.city} onChange={(v) => setLocal({ ...local, city: v })} />
            <Field label="State" value="" onChange={() => {}} disabled placeholder="Not configured" />
            <Field label="Pincode" value="" onChange={() => {}} disabled placeholder="Not configured" />
          </div>
        </Section>

        <Section title="Shipping Address">
          <Field label="Address" value={local.address} onChange={(v) => setLocal({ ...local, address: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={local.city} onChange={(v) => setLocal({ ...local, city: v })} />
            <Field label="State" value="" onChange={() => {}} disabled placeholder="Not configured" />
            <Field label="Pincode" value="" onChange={() => {}} disabled placeholder="Not configured" />
          </div>
        </Section>
      </div>

      <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-sm text-[#111c2d]">Team Members</h2>
          <button className="flex items-center gap-2 bg-[#1769E0] text-white px-4 py-2 rounded font-label-md text-sm hover:bg-[#1257b8] transition-colors">
            <Plus size={16} /> Add User
          </button>
        </div>
        <div className="p-4 text-center text-[#44474d] font-body-sm border border-dashed border-[#E4E7EC] rounded">
          Team management coming soon
        </div>
      </div>

      {company && (
        <p className="text-xs text-[#44474d] text-center">Company ID: {company.id}</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-[#E4E7EC] p-6 space-y-4">
      <h2 className="font-headline-sm text-[#111c2d]">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label, value, type = "text", onChange, disabled, placeholder,
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block font-label-md text-[#44474d] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-[#f9f9ff] border border-[#E4E7EC] rounded px-4 py-3 font-body-md text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0] focus:border-[#1769E0] disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
