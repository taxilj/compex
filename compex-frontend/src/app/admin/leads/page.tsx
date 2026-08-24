"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listAdminLeads, type AdminLead } from "@/lib/api/admin";

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAdminLeads({ limit: 50 })
      .then((result) => setLeads(result.data))
      .catch(() => setError("Failed to load enquiries."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-[#111c2d]">Enquiries</h1>
        <p className="font-body-md text-[#44474d]">Public contact submissions and RFQ-linked leads.</p>
      </div>

      {error && <p className="rounded-lg border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 font-body-sm text-[#B42318]">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 font-body-md text-[#44474d]"><Loader2 size={20} className="animate-spin" /> Loading enquiries…</div>
        ) : (
          <table className="w-full min-w-[760px]">
            <thead className="bg-[#F8FAFC] text-left">
              <tr className="border-b border-[#E4E7EC]">
                {['Contact', 'Company', 'Source', 'Status', 'Related RFQ', 'Received'].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-label-sm text-xs uppercase tracking-wide text-[#667085]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {leads.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center font-body-md text-[#667085]">No enquiries yet.</td></tr>
              ) : leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3"><p className="font-label-sm text-[#111c2d]">{lead.contactName}</p><p className="font-body-sm text-xs text-[#667085]">{lead.contactEmail}</p></td>
                  <td className="px-4 py-3 font-body-sm text-[#344054]">{lead.companyName}</td>
                  <td className="px-4 py-3 font-body-sm text-[#344054]">{lead.source.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-[#E8EEFF] px-2.5 py-1 font-label-sm text-xs text-[#175CD3]">{lead.status}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-[#344054]">{lead.rfq?.rfqNumber ?? '—'}</td>
                  <td className="px-4 py-3 font-body-sm text-xs text-[#667085]">{new Date(lead.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
