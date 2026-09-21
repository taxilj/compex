"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Search, Download, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { listAdminSalesOrders, type SalesOrder, type SalesOrderStatus } from "@/lib/api/orders";

function money(value: string | number, currency: string) {
  return `${currency} ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SalesOrderStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listAdminSalesOrders({ status: status || undefined, limit: 100 })
      .then((result) => { setOrders(result.data); setError(null); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Unable to load sales orders."))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((order) => !q || order.orderNumber.toLowerCase().includes(q) || order.customer?.company.name.toLowerCase().includes(q) || order.rfqId.toLowerCase().includes(q));
  }, [orders, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between"><div><h1 className="font-headline-lg text-[#111c2d]">Sales Orders</h1><p className="font-body-md text-[#44474d]">{loading ? "Loading…" : `${orders.length} live sales orders`}</p></div><button className="flex items-center gap-2 border border-[#E4E7EC] bg-white text-[#111c2d] px-4 py-2 rounded font-label-md hover:bg-[#f0f3ff] transition-colors"><Download size={15} /> Export</button></div>
      <div className="bg-[#f0f3ff] rounded-lg p-4 flex gap-4 items-center"><div className="relative flex-1 max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#44474d]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, RFQ or customer..." className="w-full pl-9 pr-4 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></div><select value={status} onChange={(e) => setStatus(e.target.value as SalesOrderStatus | "")} className="px-3 py-2 bg-white border border-[#E4E7EC] rounded text-sm focus:outline-none"><option value="">All Statuses</option><option value="CONFIRMED">Confirmed</option><option value="PROCESSING">Processing</option><option value="SHIPPED">Shipped</option><option value="DELIVERED">Delivered</option><option value="CANCELLED">Cancelled</option></select></div>
      {error && <div role="alert" className="rounded-lg border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318] flex items-center justify-between"><span>{error}</span><button onClick={load} className="font-label-sm underline">Retry</button></div>}
      {loading && <div className="flex justify-center py-16 text-[#44474d]"><Loader2 size={22} className="animate-spin mr-2" /> Loading sales orders…</div>}
      {!loading && !error && <div className="bg-white rounded-xl shadow-sm border border-[#E4E7EC] overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left whitespace-nowrap"><thead><tr className="bg-[#f0f3ff] border-b border-[#E4E7EC]">{["Order #", "RFQ", "Customer", "Items", "Order Value", "Status", "Date", ""].map((h) => <th key={h} className="px-5 py-3.5 font-label-sm text-[#44474d] uppercase tracking-wider text-xs">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#E4E7EC]">
        {filtered.map((order) => <tr key={order.id} className="hover:bg-[#f0f3ff]/40 transition-colors"><td className="px-5 py-4 font-mono-label text-[#0B1F3A] font-medium text-sm">{order.orderNumber}</td><td className="px-5 py-4 font-mono-label text-[#1769E0] text-sm">{order.rfqId.slice(0, 8)}</td><td className="px-5 py-4 font-body-sm text-[#111c2d] text-sm">{order.customer?.company.name ?? "—"}</td><td className="px-5 py-4 font-mono-label text-sm">{order.items.length}</td><td className="px-5 py-4 font-mono-label text-[#111c2d] font-medium text-sm">{money(order.total, order.currency)}</td><td className="px-5 py-4"><StatusBadge status={order.status.toLowerCase()} /></td><td className="px-5 py-4 font-mono-label text-[#44474d] text-xs">{order.createdAt.split("T")[0]}</td><td className="px-5 py-4"><span className="font-label-sm text-[#667085] text-xs">Live</span></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan={8} className="py-12 text-center font-body-md text-[#44474d]">No sales orders found.</td></tr>}
      </tbody></table></div></div>}
    </div>
  );
}
