"use client";
import { useState, useEffect, useMemo } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Search, Loader2 } from "lucide-react";
import { listAdminQuotations, sendAdminQuotation, type AdminQuotation } from "@/lib/api/admin";

const STATUS_TABS = ["All", "DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

function quoteStatus(s: string): string {
  const map: Record<string, string> = {
    SENT: "quote_sent", VIEWED: "quote_sent",
    ACCEPTED: "accepted", REJECTED: "rejected",
    EXPIRED: "rejected", DRAFT: "draft",
  };
  return map[s] ?? s.toLowerCase();
}

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<AdminQuotation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>("All");
  const [sendingId, setSendingId] = useState<string | null>(null);

  function load() {
    listAdminQuotations({ status: tab !== "All" ? tab : undefined, limit: 50 })
      .then((res) => { setQuotes(res.data); setTotal(res.total); setError(null); })
      .catch(() => setError("Failed to load quotations."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [tab]);

  async function handleSend(id: string) {
    setSendingId(id);
    try {
      await sendAdminQuotation(id);
      load();
    } catch {
      setError("Failed to send quotation.");
    } finally {
      setSendingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return quotes;
    const q = search.toLowerCase();
    return quotes.filter((r) =>
      r.quotationNumber.toLowerCase().includes(q) ||
      r.customer.company.name.toLowerCase().includes(q) ||
      r.rfq.rfqNumber.toLowerCase().includes(q)
    );
  }, [quotes, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Quotes</h1>
          <p className="font-body-md text-[#44474d]">
            {loading ? "Loading…" : `${total} quotations`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quote # or customer..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]"
          />
        </div>
        <div className="flex gap-1 bg-[#f0f3ff] p-1 rounded-lg overflow-x-auto">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => { setLoading(true); setError(null); setTab(s); }}
              className={`px-3 py-1.5 rounded font-label-sm text-xs whitespace-nowrap transition-colors ${tab === s ? "bg-white text-[#0B1F3A] shadow-sm" : "text-[#44474d] hover:text-[#0B1F3A]"}`}
            >
              {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-[#44474d]">
          <Loader2 size={22} className="animate-spin mr-2" /> Loading quotations…
        </div>
      )}

      {error && <p className="text-[#F04438] font-body-sm">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">
                  {["Quote #", "RFQ", "Customer", "Items", "Subtotal", "Tax", "Total", "Valid Until", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-[#f0f3ff]/40 transition-colors">
                    <td className="px-5 py-4 font-mono-label text-[#0B1F3A] font-medium text-sm">{q.quotationNumber}</td>
                    <td className="px-5 py-4 font-mono-label text-[#44474d] text-sm">{q.rfq.rfqNumber}</td>
                    <td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{q.customer.company.name}</td>
                    <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">{q.items.length}</td>
                    <td className="px-5 py-4 font-mono-label text-[#111c2d] text-sm">
                      {q.currency} {Number(q.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 font-mono-label text-[#44474d] text-sm">
                      {q.currency} {Number(q.tax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 font-mono-label text-[#111c2d] font-semibold text-sm">
                      {q.currency} {Number(q.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{q.validUntil.split("T")[0]}</td>
                    <td className="px-5 py-4"><StatusBadge status={quoteStatus(q.status)} /></td>
                    <td className="px-5 py-4">
                      {q.status === "DRAFT" && (
                        <button
                          onClick={() => handleSend(q.id)}
                          disabled={sendingId === q.id}
                          className="px-3 py-1.5 rounded font-label-sm text-xs bg-[#1769E0] text-white hover:bg-[#1257c2] disabled:opacity-50 transition-colors"
                        >
                          {sendingId === q.id ? "Sending…" : "Send to customer"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center font-body-md text-[#44474d]">No quotes found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
