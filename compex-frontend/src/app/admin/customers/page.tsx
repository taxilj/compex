"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, Plus, Search, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { createCustomer, getCustomer, listCustomers, listUsers, updateCustomer, type AdminCustomer, type AdminCustomerInput, type AdminUser } from "@/lib/api/admin";
import { Field } from "@/components/admin/Field";
import { SettingsSelect } from "@/components/admin/SettingsSelect";

const blankForm: AdminCustomerInput = {
  companyName: "", firstName: "", lastName: "", email: "", phone: "", gstin: "", city: "", address: "",
  shortName: "", billToAddress: "", shipToAddress: "", state: "", country: "", relationshipType: "", customerType: "",
  website: "", fax: "", primaryContact: "", contactEmail: "", authorisedPerson: "", paymentTerms: "", region: "",
  industrySegment: "", internalAccountNumber: "", shippingAccount: "", bankDetails: "", remarks: "",
};

const PAGE_SIZE = 50;

function formFor(customer: AdminCustomer): AdminCustomerInput {
  const c = customer.company;
  return {
    companyName: c.name, firstName: customer.user.firstName, lastName: customer.user.lastName, email: customer.user.email,
    phone: customer.user.phone ?? "", gstin: c.gstin ?? "", city: c.city ?? "", address: c.address ?? "",
    shortName: c.shortName ?? "", billToAddress: c.billToAddress ?? "", shipToAddress: c.shipToAddress ?? "",
    state: c.state ?? "", country: c.country ?? "", relationshipType: c.relationshipType ?? "", customerType: c.customerType ?? "",
    website: c.website ?? "", fax: c.fax ?? "", primaryContact: c.primaryContact ?? "", contactEmail: c.contactEmail ?? "",
    authorisedPerson: c.authorisedPerson ?? "", paymentTerms: c.paymentTerms ?? "", creditLimit: c.creditLimit ? Number(c.creditLimit) : undefined,
    region: c.region ?? "", industrySegment: c.industrySegment ?? "", internalAccountNumber: c.internalAccountNumber ?? "",
    shippingAccount: c.shippingAccount ?? "", bankDetails: c.bankDetails ?? "", remarks: c.remarks ?? "",
    salesPersonId: c.salesPerson?.id ?? null, salesCoordinatorId: c.salesCoordinator?.id ?? null, sourcingOwnerId: c.sourcingOwner?.id ?? null,
  };
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [form, setForm] = useState<AdminCustomerInput>(blankForm);
  const [staff, setStaff] = useState<AdminUser[]>([]);

  useEffect(() => {
    let active = true;
    void listCustomers({ q: search.trim() || undefined, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setCustomers(result.data);
        setTotal(result.total);
        setError(null);
      })
      .catch(() => { if (active) setError("Failed to load customers."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, retryKey, search]);

  useEffect(() => {
    let active = true;
    listUsers({ role: "STAFF", limit: 100 }).then((r) => { if (active) setStaff(r.data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  function startCreate() { setEditing(null); setForm(blankForm); setOpen(true); }
  function close() { setOpen(false); setEditing(null); setForm(blankForm); }

  async function startEdit(id: string) {
    setError(null);
    try {
      const customer = await getCustomer(id);
      setEditing(customer);
      setForm(formFor(customer));
      setOpen(true);
    } catch {
      setError("Failed to load this customer.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input: AdminCustomerInput = { ...form };
      for (const key of Object.keys(input) as (keyof AdminCustomerInput)[]) {
        const v = input[key];
        if (typeof v === "string" && v.trim() === "") (input as unknown as Record<string, unknown>)[key] = undefined;
      }
      const original = editing ? formFor(editing) : null;
      const changed = original
        ? Object.fromEntries(Object.entries(input).filter(([key, value]) => value !== (original as unknown as Record<string, unknown>)[key])) as Partial<AdminCustomerInput>
        : input;
      if (editing) await updateCustomer(editing.id, changed);
      else await createCustomer(input);
      close();
      setLoading(true);
      setPage(1);
      setRetryKey((current) => current + 1);
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="font-headline-lg text-[#111c2d]">Customer Management</h1><p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${total} live customer records`}</p></div><button onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded bg-[#0B1F3A] px-4 py-2 font-label-md text-white hover:bg-[#0B1F3A]/90"><Plus size={16} /> Add customer</button></div>
    <div className="rounded-lg bg-[#e8eeff] p-5"><div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} aria-label="Search customers" placeholder="Search company, contact, email, GSTIN…" className="w-full rounded border border-[#E4E7EC] bg-white py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></div></div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]"><span>{error}</span><button onClick={() => { setLoading(true); setRetryKey((current) => current + 1); }} className="rounded border border-current px-3 py-1 text-sm font-label-md">Retry</button></div>}
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-sm">{loading ? <div className="flex items-center justify-center py-16 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={20} /> Loading customers…</div> : <div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead><tr className="border-b border-[#E4E7EC] bg-[#f0f3ff]">{["Company", "Primary contact", "Account", "RFQs", "Quotes", "Status", ""].map((label) => <th key={label} className="px-5 py-3.5 text-xs font-label-sm uppercase tracking-wider text-[#44474d]">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#E4E7EC]">{customers.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-[#667085]">No customers found.</td></tr> : customers.map((customer) => <tr key={customer.id} className="hover:bg-[#f0f3ff]/40"><td className="px-5 py-4"><p className="font-label-md text-sm text-[#111c2d]">{customer.company.name}</p><p className="text-xs text-[#667085]">{customer.company.city ?? "No city"}</p></td><td className="px-5 py-4"><p className="text-sm text-[#111c2d]">{customer.user.firstName} {customer.user.lastName}</p><p className="text-xs text-[#667085]">{customer.user.email}</p></td><td className="px-5 py-4 font-mono text-xs text-[#111c2d]">{customer.accountNumber}</td><td className="px-5 py-4 text-right">{customer._count.rfqs}</td><td className="px-5 py-4 text-right">{customer._count.quotations}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${customer.user.status === "ACTIVE" ? "bg-[#12B76A]/10 text-[#087443]" : "bg-[#F79009]/10 text-[#9A6700]"}`}>{customer.user.status === "ACTIVE" ? "Active" : "Invitation pending"}</span></td><td className="px-5 py-4"><button onClick={() => void startEdit(customer.id)} className="inline-flex items-center gap-1 text-xs font-label-sm text-[#1769E0] hover:underline">View / edit <ArrowUpRight size={12} /></button></td></tr>)}</tbody></table></div>}</div>
    {!loading && total > 0 && <div className="flex flex-col gap-3 text-sm text-[#44474d] sm:flex-row sm:items-center sm:justify-between"><span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span><div className="flex gap-2"><button onClick={() => { setLoading(true); setPage((current) => Math.max(1, current - 1)); }} disabled={page === 1} className="rounded border border-[#E4E7EC] px-3 py-2 disabled:opacity-50">Previous</button><button onClick={() => { setLoading(true); setPage((current) => current + 1); }} disabled={page * PAGE_SIZE >= total} className="rounded border border-[#E4E7EC] px-3 py-2 disabled:opacity-50">Next</button></div></div>}
    {open && <CustomerDialog customer={editing} form={form} saving={saving} staff={staff} onChange={setForm} onClose={close} onSubmit={submit} />}
  </div>;
}

function CustomerDialog({ customer, form, saving, staff, onChange, onClose, onSubmit }: { customer: AdminCustomer | null; form: AdminCustomerInput; saving: boolean; staff: AdminUser[]; onChange: (value: AdminCustomerInput) => void; onClose: () => void; onSubmit: (event: React.FormEvent) => Promise<void> }) {
  const set = <K extends keyof AdminCustomerInput>(key: K, value: AdminCustomerInput[K]) => onChange({ ...form, [key]: value });
  return (
    <div role="dialog" aria-modal="true" aria-label={customer ? "Edit customer" : "Add customer"} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={(event) => void onSubmit(event)} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div><h2 className="font-headline-md text-[#111c2d]">{customer ? "Edit customer" : "Add customer"}</h2><p className="mt-1 text-sm text-[#667085]">{customer ? "Update customer and company details." : "The customer receives an invitation and chooses their own password."}</p></div>
          <button type="button" onClick={onClose} aria-label="Close customer dialog" className="text-[#667085] hover:text-[#111c2d]"><X /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Company name *" value={form.companyName} onChange={(v) => set("companyName", v)} required />
            <Field label="Short name" value={form.shortName ?? ""} onChange={(v) => set("shortName", v)} />
            <Field label="First name *" value={form.firstName} onChange={(v) => set("firstName", v)} required />
            <Field label="Last name *" value={form.lastName} onChange={(v) => set("lastName", v)} required />
            <Field label="Business email *" value={form.email} onChange={(v) => set("email", v)} required type="email" />
            <Field label="Phone" value={form.phone ?? ""} onChange={(v) => set("phone", v)} />
            <Field label="GSTIN / Registration number" value={form.gstin ?? ""} onChange={(v) => set("gstin", v)} />
            <Field label="Website" value={form.website ?? ""} onChange={(v) => set("website", v)} />
            <Field label="Fax" value={form.fax ?? ""} onChange={(v) => set("fax", v)} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="City" value={form.city ?? ""} onChange={(v) => set("city", v)} />
            <SettingsSelect category="STATE" label="State" value={form.state ?? ""} onChange={(v) => set("state", v)} />
            <SettingsSelect category="COUNTRY" label="Country" value={form.country ?? ""} onChange={(v) => set("country", v)} />
            <SettingsSelect category="REGION" label="Region" value={form.region ?? ""} onChange={(v) => set("region", v)} />
          </div>
          <Field label="Address" value={form.address ?? ""} onChange={(v) => set("address", v)} textarea />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Bill-to address" value={form.billToAddress ?? ""} onChange={(v) => set("billToAddress", v)} textarea />
            <Field label="Ship-to address" value={form.shipToAddress ?? ""} onChange={(v) => set("shipToAddress", v)} textarea />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SettingsSelect category="RELATIONSHIP_TYPE" label="Customer / Vendor / Both" value={form.relationshipType ?? ""} onChange={(v) => set("relationshipType", v)} />
            <SettingsSelect category="CUSTOMER_TYPE" label="Customer type" value={form.customerType ?? ""} onChange={(v) => set("customerType", v)} />
            <SettingsSelect category="PAYMENT_TERMS" label="Payment terms" value={form.paymentTerms ?? ""} onChange={(v) => set("paymentTerms", v)} />
            <SettingsSelect category="INDUSTRY_SEGMENT" label="Industry segment" value={form.industrySegment ?? ""} onChange={(v) => set("industrySegment", v)} />
            <Field label="Credit limit / MOV" value={form.creditLimit != null ? String(form.creditLimit) : ""} onChange={(v) => set("creditLimit", v === "" ? undefined : Number(v))} type="number" />
            <Field label="Primary contact" value={form.primaryContact ?? ""} onChange={(v) => set("primaryContact", v)} />
            <Field label="Contact email" value={form.contactEmail ?? ""} onChange={(v) => set("contactEmail", v)} type="email" />
            <Field label="Authorised person" value={form.authorisedPerson ?? ""} onChange={(v) => set("authorisedPerson", v)} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StaffSelect label="Sales person" staff={staff} value={form.salesPersonId ?? ""} onChange={(v) => set("salesPersonId", v || null)} />
            <StaffSelect label="Sales coordinator" staff={staff} value={form.salesCoordinatorId ?? ""} onChange={(v) => set("salesCoordinatorId", v || null)} />
            <StaffSelect label="Sourcing owner" staff={staff} value={form.sourcingOwnerId ?? ""} onChange={(v) => set("sourcingOwnerId", v || null)} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Internal account number" value={form.internalAccountNumber ?? ""} onChange={(v) => set("internalAccountNumber", v)} />
            <Field label="Shipping account" value={form.shippingAccount ?? ""} onChange={(v) => set("shippingAccount", v)} />
          </div>
          <Field label="Bank details" value={form.bankDetails ?? ""} onChange={(v) => set("bankDetails", v)} textarea />
          <Field label="Remarks" value={form.remarks ?? ""} onChange={(v) => set("remarks", v)} textarea />
        </div>

        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded border border-[#E4E7EC] px-4 py-2 font-label-md text-[#111c2d]">Cancel</button><button disabled={saving} className="rounded bg-[#1769E0] px-4 py-2 font-label-md text-white disabled:opacity-60">{saving ? "Saving…" : customer ? "Save changes" : "Create and send invitation"}</button></div>
      </form>
    </div>
  );
}

function StaffSelect({ label, staff, value, onChange }: { label: string; staff: AdminUser[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
        <option value="">—</option>
        {staff.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
      </select>
    </div>
  );
}
