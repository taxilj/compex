"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { convertLeadToRfq, listAdminLeads, listCustomers, type AdminLead, type AdminCustomer } from "@/lib/api/admin";

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [selectedCustomerByLead, setSelectedCustomerByLead] = useState<Record<string, string>>({});
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listAdminLeads({ limit: 50 }), listCustomers({ limit: 100 })])
      .then(([leadResult, customerResult]) => {
        setLeads(leadResult.data);
        setCustomers(customerResult.data);
      })
      .catch(() => setError("Failed to load enquiries."))
      .finally(() => setLoading(false));
  }, []);

  async function convertToRfq(lead: AdminLead) {
    const customerId = selectedCustomerByLead[lead.id];
    if (!customerId) return;
    setConvertingLeadId(lead.id);
    setError(null);
    try {
      const result = await convertLeadToRfq(lead.id, customerId);
      setLeads((current) => current.map((item) => item.id === lead.id ? result.lead : item));
    } catch {
      setError("Could not create an RFQ from this enquiry.");
    } finally {
      setConvertingLeadId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Enquiries</h1>
          <p className="font-body-md text-[#44474d]">Public contact submissions and RFQ-linked leads.</p>
        </div>
        <a
          href="/api/v1/admin/leads/export"
          className="rounded border border-[#E4E7EC] bg-white px-4 py-2 font-label-sm text-[#344054] hover:bg-[#F8FAFC]"
        >
          Export CSV
        </a>
      </div>

      {error && <p className="rounded-lg border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 font-body-sm text-[#B42318]">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 font-body-md text-[#44474d]"><Loader2 size={20} className="animate-spin" /> Loading enquiries…</div>
        ) : (
          <table className="w-full min-w-[960px]">
            <thead className="bg-[#F8FAFC] text-left">
              <tr className="border-b border-[#E4E7EC]">
                {['Reference', 'Contact', 'Company', 'Source', 'Items', 'Delivery', 'Notification', 'Status', 'Received', 'RFQ'].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-label-sm text-xs uppercase tracking-wide text-[#667085]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {leads.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center font-body-md text-[#667085]">No enquiries yet.</td></tr>
              ) : leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 font-mono text-xs text-[#344054]">{lead.referenceNumber ?? lead.rfq?.rfqNumber ?? '—'}</td>
                  <td className="px-4 py-3"><p className="font-label-sm text-[#111c2d]">{lead.contactName}</p><p className="font-body-sm text-xs text-[#667085]">{lead.contactEmail}</p></td>
                  <td className="px-4 py-3 font-body-sm text-[#344054]">{lead.companyName}</td>
                  <td className="px-4 py-3 font-body-sm text-[#344054]">{lead.source.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3 font-body-sm text-xs text-[#344054]">{lead.items.length ? lead.items.map((item) => `${item.mpn} × ${item.quantity}`).join(', ') : '—'}</td>
                  <td className="px-4 py-3 font-body-sm text-xs text-[#344054]">{lead.deliveryLocation ?? '—'}</td>
                  <td className="px-4 py-3 font-body-sm text-xs text-[#344054]">{lead.notificationStatus ?? '—'}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[#E8EEFF] px-2.5 py-1 font-label-sm text-xs text-[#175CD3]">{lead.status}</span></td>
                  <td className="px-4 py-3 font-body-sm text-xs text-[#667085]">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {lead.rfq ? (
                      <a href={`/admin/rfqs/${lead.rfq.id}`} className="font-mono text-xs text-[#175CD3] hover:underline">{lead.rfq.rfqNumber}</a>
                    ) : (
                      <div className="flex min-w-56 flex-col gap-2">
                        <select
                          aria-label={`Customer for ${lead.referenceNumber ?? lead.contactEmail}`}
                          value={selectedCustomerByLead[lead.id] ?? ""}
                          onChange={(event) => setSelectedCustomerByLead((current) => ({ ...current, [lead.id]: event.target.value }))}
                          className="rounded border border-[#D0D5DD] bg-white px-2 py-1 text-xs text-[#344054]"
                        >
                          <option value="">Select customer account</option>
                          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company.name} ({customer.accountNumber})</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => void convertToRfq(lead)}
                          disabled={!selectedCustomerByLead[lead.id] || convertingLeadId === lead.id}
                          className="rounded bg-[#1769E0] px-2 py-1 text-xs font-label-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {convertingLeadId === lead.id ? "Creating…" : "Create RFQ"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
