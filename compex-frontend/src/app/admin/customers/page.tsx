"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Loader2, Plus, Search, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { createCustomer, getCustomer, listCustomers, updateCustomer, type AdminCustomer, type AdminCustomerInput } from "@/lib/api/admin";

const blankForm: AdminCustomerInput = { companyName: "", firstName: "", lastName: "", email: "", phone: "", gstin: "", city: "", address: "" };

function formFor(customer: AdminCustomer): AdminCustomerInput {
  return { companyName: customer.company.name, firstName: customer.user.firstName, lastName: customer.user.lastName, email: customer.user.email, phone: customer.user.phone ?? "", gstin: customer.company.gstin ?? "", city: customer.company.city ?? "", address: customer.company.address ?? "" };
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [form, setForm] = useState<AdminCustomerInput>(blankForm);

  useEffect(() => {
    let active = true;
    void listCustomers({ limit: 100 })
      .then((result) => {
        if (!active) return;
        setCustomers(result.data);
        setTotal(result.total);
      })
      .catch(() => { if (active) setError("Failed to load customers."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? customers.filter((customer) => [customer.accountNumber, customer.company.name, customer.user.firstName, customer.user.lastName, customer.user.email, customer.company.gstin ?? ""].some((value) => value.toLowerCase().includes(q))) : customers;
  }, [customers, search]);

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
      const input = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || undefined])) as AdminCustomerInput;
      const saved = editing ? await updateCustomer(editing.id, input) : await createCustomer(input);
      setCustomers((current) => editing ? current.map((customer) => customer.id === saved.id ? saved : customer) : [saved, ...current]);
      setTotal((current) => editing ? current : current + 1);
      close();
    } catch (exception) {
      setError(exception instanceof ApiError ? exception.message : "Unable to save customer.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="font-headline-lg text-[#111c2d]">Customer Management</h1><p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${total} live customer records`}</p></div><button onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded bg-[#0B1F3A] px-4 py-2 font-label-md text-white hover:bg-[#0B1F3A]/90"><Plus size={16} /> Add customer</button></div>
    <div className="rounded-lg bg-[#e8eeff] p-5"><div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search customers" placeholder="Search company, contact, email, GSTIN…" className="w-full rounded border border-[#E4E7EC] bg-white py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></div></div>
    {error && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>}
    <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-sm">{loading ? <div className="flex items-center justify-center py-16 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={20} /> Loading customers…</div> : <div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead><tr className="border-b border-[#E4E7EC] bg-[#f0f3ff]">{["Company", "Primary contact", "Account", "RFQs", "Quotes", "Status", ""].map((label) => <th key={label} className="px-5 py-3.5 text-xs font-label-sm uppercase tracking-wider text-[#44474d]">{label}</th>)}</tr></thead><tbody className="divide-y divide-[#E4E7EC]">{filtered.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-[#667085]">No customers found.</td></tr> : filtered.map((customer) => <tr key={customer.id} className="hover:bg-[#f0f3ff]/40"><td className="px-5 py-4"><p className="font-label-md text-sm text-[#111c2d]">{customer.company.name}</p><p className="text-xs text-[#667085]">{customer.company.city ?? "No city"}</p></td><td className="px-5 py-4"><p className="text-sm text-[#111c2d]">{customer.user.firstName} {customer.user.lastName}</p><p className="text-xs text-[#667085]">{customer.user.email}</p></td><td className="px-5 py-4 font-mono text-xs text-[#111c2d]">{customer.accountNumber}</td><td className="px-5 py-4 text-right">{customer._count.rfqs}</td><td className="px-5 py-4 text-right">{customer._count.quotations}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${customer.user.status === "ACTIVE" ? "bg-[#12B76A]/10 text-[#087443]" : "bg-[#F79009]/10 text-[#9A6700]"}`}>{customer.user.status === "ACTIVE" ? "Active" : "Invitation pending"}</span></td><td className="px-5 py-4"><button onClick={() => void startEdit(customer.id)} className="inline-flex items-center gap-1 text-xs font-label-sm text-[#1769E0] hover:underline">View / edit <ArrowUpRight size={12} /></button></td></tr>)}</tbody></table></div>}</div>
    {open && <CustomerDialog customer={editing} form={form} saving={saving} onChange={setForm} onClose={close} onSubmit={submit} />}
  </div>;
}

function CustomerDialog({ customer, form, saving, onChange, onClose, onSubmit }: { customer: AdminCustomer | null; form: AdminCustomerInput; saving: boolean; onChange: (value: AdminCustomerInput) => void; onClose: () => void; onSubmit: (event: React.FormEvent) => Promise<void> }) {
  const fields = [["companyName", "Company name", true], ["firstName", "First name", true], ["lastName", "Last name", true], ["email", "Business email", true], ["phone", "Phone", false], ["gstin", "GSTIN", false], ["city", "City", false], ["address", "Address", false]] as const;
  return <div role="dialog" aria-modal="true" aria-label={customer ? "Edit customer" : "Add customer"} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={(event) => void onSubmit(event)} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h2 className="font-headline-md text-[#111c2d]">{customer ? "Edit customer" : "Add customer"}</h2><p className="mt-1 text-sm text-[#667085]">{customer ? "Update customer and company details." : "The customer receives an invitation and chooses their own password."}</p></div><button type="button" onClick={onClose} aria-label="Close customer dialog" className="text-[#667085] hover:text-[#111c2d]"><X /></button></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{fields.map(([name,label,required]) => <label key={name} className={name === "companyName" || name === "address" ? "md:col-span-2" : ""}><span className="font-label-sm text-[#44474d]">{label}{required ? " *" : ""}</span><input required={required} type={name === "email" ? "email" : "text"} value={form[name] ?? ""} onChange={(event) => onChange({ ...form, [name]: event.target.value })} className="mt-1.5 w-full rounded border border-[#E4E7EC] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></label>)}</div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded border border-[#E4E7EC] px-4 py-2 font-label-md text-[#111c2d]">Cancel</button><button disabled={saving} className="rounded bg-[#1769E0] px-4 py-2 font-label-md text-white disabled:opacity-60">{saving ? "Saving…" : customer ? "Save changes" : "Create and send invitation"}</button></div></form></div>;
}
