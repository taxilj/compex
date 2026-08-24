"use client";
import { useState, useEffect } from "react";
import { Loader2, Save, Check } from "lucide-react";
import { listOrganizations, createOrganization, updateOrganization, type Organization, type OrganizationInput } from "@/lib/api/admin";

const EMPTY: OrganizationInput = {
  companyName: "", shortName: "", address: "", country: "", phone: "", email: "", website: "",
  contactPerson: "", ffAccount: "", currency: "INR", companyRegistrationNo: "",
  invoicePrefix: "", proformaInvoicePrefix: "", packingSlipPrefix: "", cocPrefix: "",
  orderAckPrefix: "", quotationPrefix: "", salesOrderPrefix: "", purchaseOrderPrefix: "",
  itemNoPrefix: "", vendorCodePrefix: "", customerCodePrefix: "", contactCodePrefix: "",
  location: "", rmaPrefix: "", bankName: "", bankAccount: "", bankAddress: "",
  swiftIfscMicr: "", routingCode: "", signatureUrl: "", logoUrl: "",
};

function Field({ label, field, form, onChange }: { label: string; field: keyof OrganizationInput; form: OrganizationInput; onChange: (f: keyof OrganizationInput, v: string) => void }) {
  return (
    <div>
      <label className="block font-label-sm text-[#44474d] text-sm mb-1.5">{label}</label>
      <input
        value={form[field] ?? ""}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full px-3 py-2.5 bg-white border border-[#E4E7EC] rounded-lg text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0]"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="font-label-lg text-[#111c2d] font-semibold">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
    </div>
  );
}

export default function AdminOrganizationPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [form, setForm] = useState<OrganizationInput>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listOrganizations()
      .then((res) => {
        if (res.data.length > 0) {
          const org: Organization = res.data[0];
          setOrgId(org.id);
          const { id, createdAt, updatedAt, ...rest } = org;
          void id; void createdAt; void updatedAt;
          setForm(rest);
        }
      })
      .catch(() => setError("Failed to load organization."))
      .finally(() => setLoading(false));
  }, []);

  function onChange(field: keyof OrganizationInput, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (orgId) {
        await updateOrganization(orgId, form);
      } else {
        const created = await createOrganization(form);
        setOrgId(created.id);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      setError("Failed to save organization details.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#44474d]">
        <Loader2 size={22} className="animate-spin mr-2" /> Loading organization…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Organization</h1>
          <p className="font-body-md text-[#44474d]">Company profile, document prefixes, and banking details.</p>
        </div>
        {saved && (
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

      <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6 space-y-8">
        <Section title="Company Information">
          <Field label="Company Name" field="companyName" form={form} onChange={onChange} />
          <Field label="Short Name" field="shortName" form={form} onChange={onChange} />
          <Field label="Address" field="address" form={form} onChange={onChange} />
          <Field label="Country" field="country" form={form} onChange={onChange} />
          <Field label="Phone" field="phone" form={form} onChange={onChange} />
          <Field label="Email" field="email" form={form} onChange={onChange} />
          <Field label="Website" field="website" form={form} onChange={onChange} />
          <Field label="Contact Person" field="contactPerson" form={form} onChange={onChange} />
          <Field label="FF Account" field="ffAccount" form={form} onChange={onChange} />
          <Field label="Currency" field="currency" form={form} onChange={onChange} />
          <Field label="Company Registration No" field="companyRegistrationNo" form={form} onChange={onChange} />
          <Field label="Location" field="location" form={form} onChange={onChange} />
        </Section>

        <Section title="Document Prefixes">
          <Field label="Invoice Prefix" field="invoicePrefix" form={form} onChange={onChange} />
          <Field label="Proforma Invoice Prefix" field="proformaInvoicePrefix" form={form} onChange={onChange} />
          <Field label="Packing Slip Prefix" field="packingSlipPrefix" form={form} onChange={onChange} />
          <Field label="COC Prefix" field="cocPrefix" form={form} onChange={onChange} />
          <Field label="Order Ack Prefix" field="orderAckPrefix" form={form} onChange={onChange} />
          <Field label="Quotation Prefix" field="quotationPrefix" form={form} onChange={onChange} />
          <Field label="Sales Order Prefix" field="salesOrderPrefix" form={form} onChange={onChange} />
          <Field label="Purchase Order Prefix" field="purchaseOrderPrefix" form={form} onChange={onChange} />
          <Field label="Item No Prefix" field="itemNoPrefix" form={form} onChange={onChange} />
          <Field label="Vendor Code Prefix" field="vendorCodePrefix" form={form} onChange={onChange} />
          <Field label="Customer Code Prefix" field="customerCodePrefix" form={form} onChange={onChange} />
          <Field label="Contact Code Prefix" field="contactCodePrefix" form={form} onChange={onChange} />
          <Field label="RMA Prefix" field="rmaPrefix" form={form} onChange={onChange} />
        </Section>

        <Section title="Bank Details">
          <Field label="Bank Name" field="bankName" form={form} onChange={onChange} />
          <Field label="Bank Account" field="bankAccount" form={form} onChange={onChange} />
          <Field label="Bank Address" field="bankAddress" form={form} onChange={onChange} />
          <Field label="SWIFT / IFSC / MICR" field="swiftIfscMicr" form={form} onChange={onChange} />
          <Field label="Routing Code" field="routingCode" form={form} onChange={onChange} />
        </Section>

        <Section title="Branding">
          <Field label="Signature URL" field="signatureUrl" form={form} onChange={onChange} />
          <Field label="Logo URL" field="logoUrl" form={form} onChange={onChange} />
        </Section>

        <div className="flex justify-end pt-4 border-t border-[#E4E7EC]">
          <button
            onClick={handleSave}
            disabled={saving || !form.companyName || !form.shortName}
            className="flex items-center gap-2 bg-[#0B1F3A] text-white px-5 py-2.5 rounded-lg font-label-md text-sm hover:bg-[#0B1F3A]/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
