"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { createUser, listOrganizations, listUsers, updateUser, type AdminUser, type CreateUserInput, type Organization, type UpdateUserInput } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { Field } from "@/components/admin/Field";
import { SettingsSelect } from "@/components/admin/SettingsSelect";

const emptyForm: CreateUserInput = { email: "", firstName: "", lastName: "", role: "STAFF" };

function formFor(u: AdminUser): CreateUserInput & { status?: "ACTIVE" | "SUSPENDED" } {
  return {
    email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role,
    screenName: u.screenName ?? "", organizationId: u.organizationId ?? undefined, position: u.position ?? "",
    department: u.department ?? "", mobile: u.mobile ?? "", phone: u.phone ?? "", address: u.address ?? "",
    skype: u.skype ?? "", remarks: u.remarks ?? "", status: u.status === "PENDING_VERIFICATION" ? undefined : u.status,
  };
}

const statusBadge: Record<AdminUser["status"], string> = {
  ACTIVE: "bg-[#12B76A]/10 text-[#087443]",
  PENDING_VERIFICATION: "bg-[#F79009]/10 text-[#9A6700]",
  SUSPENDED: "bg-[#F04438]/10 text-[#B42318]",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<CreateUserInput & { status?: "ACTIVE" | "SUSPENDED" }>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listUsers({ search: search || undefined, limit: 100 })
      .then((r) => { setUsers(r.data); setTotal(r.total); setError(null); })
      .catch(() => setError("Failed to load users."))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { void listOrganizations().then((r) => setOrganizations(r.data)).catch(() => setOrganizations([])); }, []);

  function openCreate() { setEditing(null); setForm(emptyForm); setFormError(null); setShowModal(true); }
  function openEdit(u: AdminUser) { setEditing(u); setForm(formFor(u)); setFormError(null); setShowModal(true); }
  function close() { setShowModal(false); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        const { role, ...rest } = form;
        void role;
        const payload: UpdateUserInput = { ...rest };
        for (const key of Object.keys(payload) as (keyof UpdateUserInput)[]) {
          const v = payload[key];
          if (typeof v === "string" && v.trim() === "") (payload as unknown as Record<string, unknown>)[key] = undefined;
        }
        await updateUser(editing.id, payload);
      } else {
        const payload: CreateUserInput = { ...form };
        for (const key of Object.keys(payload) as (keyof CreateUserInput)[]) {
          const v = payload[key];
          if (typeof v === "string" && v.trim() === "") (payload as unknown as Record<string, unknown>)[key] = undefined;
        }
        await createUser(payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">User Management</h1>
          <p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${total} user${total === 1 ? "" : "s"}`}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90">
          <Plus size={15} /> Add User
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" placeholder="Search name or email…" className="w-full rounded border border-[#E4E7EC] bg-white py-2.5 pl-9 pr-4 focus:outline-none focus:ring-2 focus:ring-[#1769E0]" />
      </div>

      {error && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318]">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={20} /> Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                  {["Name", "Email", "Role", "Organization", "Position", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center font-body-md text-[#44474d]">No users found.</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f0f3ff]/40 transition-colors group">
                    <td className="px-5 py-4 font-label-md text-[#111c2d] text-sm">{u.firstName} {u.lastName}{u.screenName ? <span className="text-[#667085] font-body-sm"> ({u.screenName})</span> : null}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{u.email}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{u.role}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{u.organization?.shortName ?? "—"}</td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{u.position ?? "—"}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${statusBadge[u.status]}`}>{u.status === "PENDING_VERIFICATION" ? "Invitation pending" : u.status === "ACTIVE" ? "Active" : "Suspended"}</span></td>
                    <td className="px-5 py-4">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(u)} className="font-label-sm text-[#1769E0] hover:underline text-xs">Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div role="dialog" aria-modal="true" aria-label={editing ? "Edit user" : "Add user"} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E7EC]">
              <h2 className="font-headline-sm text-[#111c2d]">{editing ? "Edit User" : "Add User"}</h2>
              <button onClick={close} className="text-[#44474d] hover:text-[#111c2d]"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              {formError && <p role="alert" className="font-body-sm text-[#B42318]">{formError}</p>}
              {!editing && <p className="font-body-sm text-[#667085]">The user receives an invitation and chooses their own password.</p>}
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name *" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
                <Field label="Last name *" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
                <Field label="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required type="email" />
                <Field label="Screen name" value={form.screenName ?? ""} onChange={(v) => setForm({ ...form, screenName: v })} />
                {!editing && (
                  <div>
                    <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Role</label>
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CreateUserInput["role"] })} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
                      <option value="STAFF">Staff</option>
                      <option value="ADMIN">Admin</option>
                      <option value="CUSTOMER">Customer</option>
                    </select>
                  </div>
                )}
                {editing && (
                  <div>
                    <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Status</label>
                    <select value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: (e.target.value || undefined) as "ACTIVE" | "SUSPENDED" | undefined })} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
                      <option value="">— (unchanged)</option>
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">Organization</label>
                  <select value={form.organizationId ?? ""} onChange={(e) => setForm({ ...form, organizationId: e.target.value || undefined })} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm">
                    <option value="">—</option>
                    {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.shortName || organization.companyName}</option>)}
                  </select>
                </div>
                <SettingsSelect category="POSITION" label="Position" value={form.position ?? ""} onChange={(v) => setForm({ ...form, position: v })} />
                <SettingsSelect category="DEPARTMENT" label="Department" value={form.department ?? ""} onChange={(v) => setForm({ ...form, department: v })} />
                <Field label="Mobile" value={form.mobile ?? ""} onChange={(v) => setForm({ ...form, mobile: v })} />
                <Field label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
                <Field label="Skype" value={form.skype ?? ""} onChange={(v) => setForm({ ...form, skype: v })} />
              </div>
              <Field label="Address" value={form.address ?? ""} onChange={(v) => setForm({ ...form, address: v })} textarea />
              <Field label="Remarks" value={form.remarks ?? ""} onChange={(v) => setForm({ ...form, remarks: v })} textarea />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={close} className="px-4 py-2 rounded border border-[#E4E7EC] font-label-md text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-[#0B1F3A] text-white font-label-md text-sm disabled:opacity-50">{saving ? "Saving…" : editing ? "Save changes" : "Create and send invitation"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
