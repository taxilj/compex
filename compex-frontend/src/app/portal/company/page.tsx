"use client";
import { useState } from "react";
import { mockCompany } from "@/data/mock/company";
import { Save, Plus, Edit2 } from "lucide-react";

export default function CompanyProfilePage() {
  const [company, setCompany] = useState(mockCompany);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Company Profile</h1>
          <p className="font-body-md text-[#44474d] mt-1">Manage your company information and settings</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded font-label-md transition-colors ${saved ? "bg-[#12B76A] text-white" : "bg-[#0B1F3A] text-white hover:bg-[#0B1F3A]/90"}`}
        >
          <Save size={18} /> {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company info */}
        <Section title="Company Information">
          <Field label="Company Name" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
          <Field label="GSTIN" value={company.gstin} onChange={(v) => setCompany({ ...company, gstin: v })} />
          <Field label="PAN" value={company.pan || ""} onChange={(v) => setCompany({ ...company, pan: v })} />
          <Field label="Website" value={company.website || ""} onChange={(v) => setCompany({ ...company, website: v })} />
        </Section>

        {/* Contact */}
        <Section title="Contact Information">
          <Field label="Contact Person" value={company.contactPerson} onChange={(v) => setCompany({ ...company, contactPerson: v })} />
          <Field label="Email" value={company.email} type="email" onChange={(v) => setCompany({ ...company, email: v })} />
          <Field label="Phone" value={company.phone} type="tel" onChange={(v) => setCompany({ ...company, phone: v })} />
        </Section>

        {/* Billing */}
        <Section title="Billing Address">
          <Field label="Address Line 1" value={company.billingAddress.line1} onChange={(v) => setCompany({ ...company, billingAddress: { ...company.billingAddress, line1: v } })} />
          <Field label="Address Line 2" value={company.billingAddress.line2 || ""} onChange={(v) => setCompany({ ...company, billingAddress: { ...company.billingAddress, line2: v } })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={company.billingAddress.city} onChange={(v) => setCompany({ ...company, billingAddress: { ...company.billingAddress, city: v } })} />
            <Field label="State" value={company.billingAddress.state} onChange={(v) => setCompany({ ...company, billingAddress: { ...company.billingAddress, state: v } })} />
            <Field label="Pincode" value={company.billingAddress.pincode} onChange={(v) => setCompany({ ...company, billingAddress: { ...company.billingAddress, pincode: v } })} />
          </div>
        </Section>

        {/* Shipping */}
        <Section title="Shipping Address">
          <Field label="Address Line 1" value={company.shippingAddress.line1} onChange={(v) => setCompany({ ...company, shippingAddress: { ...company.shippingAddress, line1: v } })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="City" value={company.shippingAddress.city} onChange={(v) => setCompany({ ...company, shippingAddress: { ...company.shippingAddress, city: v } })} />
            <Field label="State" value={company.shippingAddress.state} onChange={(v) => setCompany({ ...company, shippingAddress: { ...company.shippingAddress, state: v } })} />
            <Field label="Pincode" value={company.shippingAddress.pincode} onChange={(v) => setCompany({ ...company, shippingAddress: { ...company.shippingAddress, pincode: v } })} />
          </div>
        </Section>
      </div>

      {/* Users */}
      <div className="bg-white rounded-lg border border-[#E4E7EC] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-headline-sm text-[#111c2d]">Team Members</h2>
          <button className="flex items-center gap-2 bg-[#1769E0] text-white px-4 py-2 rounded font-label-md text-sm hover:bg-[#1257b8] transition-colors">
            <Plus size={16} /> Add User
          </button>
        </div>
        <div className="space-y-3">
          {company.users.map((user) => (
            <div key={user.id} className="flex items-center gap-4 p-3 rounded border border-[#E4E7EC] hover:bg-[#f0f3ff]/50">
              <div className="w-10 h-10 rounded-full bg-[#d9e3fb] flex items-center justify-center font-bold text-[#0B1F3A]">
                {user.initials}
              </div>
              <div className="flex-1">
                <p className="font-label-md text-[#111c2d]">{user.name}</p>
                <p className="font-body-sm text-[#44474d]">{user.email}</p>
              </div>
              <span className={`px-3 py-1 rounded-full font-label-sm text-xs ${
                user.role === "admin" ? "bg-[#0B1F3A] text-white"
                : user.role === "buyer" ? "bg-[#1769E0]/10 text-[#1769E0]"
                : "bg-[#E4E7EC] text-[#44474d]"
              }`}>
                {user.role}
              </span>
              <button className="p-1 text-[#44474d] hover:text-[#1769E0]"><Edit2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>
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

function Field({ label, value, type = "text", onChange }: { label: string; value: string; type?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block font-label-md text-[#44474d] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#f9f9ff] border border-[#E4E7EC] rounded px-4 py-3 font-body-md text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0] focus:border-[#1769E0]"
      />
    </div>
  );
}