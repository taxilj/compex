"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Download, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ApiError } from "@/lib/api/client";
import { listAdminPurchaseOrders, type PurchaseOrder, type PurchaseOrderStatus } from "@/lib/api/orders";

const STATUS_TABS: ("All" | PurchaseOrderStatus)[] = ["All", "PROCESSING", "SENT", "ACKNOWLEDGED", "SHIPPED", "DELIVERED"];
function money(value: string | number, currency: string) { return `${currency} ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`; }

export default function AdminPurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"All" | PurchaseOrderStatus>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { setLoading(true); listAdminPurchaseOrders({ status: tab === "All" ? undefined : tab, limit: 100 }).then((r) => { setOrders(r.data); setError(null); }).catch((e) => setError(e instanceof ApiError ? e.message : "Unable to load purchase orders.")).finally(() => setLoading(false)); }, [tab]);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => { const q = search.toLowerCase(); return orders.filter((po) => !q || po.orderNumber.toLowerCase().includes(q) || po.vendor?.name.toLowerCase().includes(q)); }, [orders, search]);

  return <div className="space-y-6">
    <div className="flex items-end justify-between"><div><h1 className="font-headline-lg text-[#111c2d]">Purchase Orders</h1><p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${orders.length} live purchase orders`}</p></div><button className="flex items-center gap-2 border border-[#E4E7EC] bg-white px-4 py-2 rounded font-label-md text-sm text-[#111c2d] hover:bg-[#f0f3ff]"><Download size={15} /> Export</button></div>
    <div className="flex flex-wrap gap-3 items-center"><div className="relative flex-1 min-w-[200px] max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PO # or vendor..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></div><div className="flex gap-1 bg-[#f0f3ff] p-1 rounded-lg overflow-x-auto">{STATUS_TABS.map((s) => <button key={s} onClick={() => setTab(s)} className={`px-3 py-1.5 rounded font-label-sm text-xs whitespace-nowrap transition-colors ${tab === s ? "bg-white text-[#0B1F3A] shadow-sm" : "text-[#44474d] hover:text-[#0B1F3A]"}`}>{s === "All" ? s : s.replaceAll("_", " ")}</button>)}</div></div>
    {error && <div role="alert" className="rounded-lg border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318] flex justify-between"><span>{error}</span><button onClick={load} className="font-label-sm underline">Retry</button></div>}
    {loading && <div className="flex justify-center py-16 text-[#44474d]"><Loader2 size={22} className="animate-spin mr-2" /> Loading purchase orders…</div>}
    {!loading && !error && <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead><tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">{["PO #", "Vendor", "Items", "Value", "Currency", "Status", "ETA"].map((h) => <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#E4E7EC]">{filtered.map((po) => <tr key={po.id} className="hover:bg-[#f0f3ff]/40 transition-colors"><td className="px-5 py-4 font-mono-label text-[#0B1F3A] font-medium text-sm">{po.orderNumber}</td><td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{po.vendor?.name ?? "—"}</td><td className="px-5 py-4 font-mono-label text-sm">{po.items.length}</td><td className="px-5 py-4 font-mono-label text-[#111c2d] font-semibold text-sm">{money(po.total, po.currency)}</td><td className="px-5 py-4"><span className="font-mono-label text-xs bg-[#f0f3ff] text-[#0B1F3A] px-2 py-0.5 rounded">{po.currency}</span></td><td className="px-5 py-4"><StatusBadge status={po.status.toLowerCase()} /></td><td className="px-5 py-4 font-body-sm text-[#44474d] text-sm">{po.expectedDate?.split("T")[0] ?? "—"}</td></tr>)}{filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center font-body-md text-[#44474d]">No purchase orders found.</td></tr>}</tbody></table></div></div>}
  </div>;
}
