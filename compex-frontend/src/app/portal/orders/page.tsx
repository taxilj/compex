"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { listCustomerOrders, type SalesOrder, type SalesOrderStatus } from "@/lib/api/orders";

const tabs: ("All" | SalesOrderStatus)[] = ["All", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
function money(value: string | number, currency: string) { return `${currency} ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`; }

export default function OrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]); const [activeTab, setActiveTab] = useState<"All" | SalesOrderStatus>("All"); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { setLoading(true); listCustomerOrders({ status: activeTab === "All" ? undefined : activeTab, limit: 50 }).then((r) => { setOrders(r.data); setError(null); }).catch((e) => setError(e instanceof ApiError ? e.message : "Unable to load orders.")).finally(() => setLoading(false)); }, [activeTab]);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => orders, [orders]);
  return <div className="max-w-[1280px] mx-auto space-y-6"><div><h1 className="font-headline-lg text-[#111c2d]">My Orders</h1><p className="font-body-md text-[#44474d] mt-1">{loading ? "Loading…" : `${orders.length} live orders`}</p></div>
    <div className="flex gap-1 bg-[#f0f3ff] rounded-lg p-1 overflow-x-auto">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded font-label-md text-sm whitespace-nowrap transition-colors ${activeTab === tab ? "bg-white text-[#0B1F3A] shadow-sm" : "text-[#44474d] hover:text-[#111c2d]"}`}>{tab === "All" ? tab : tab.replaceAll("_", " ")}</button>)}</div>
    {error && <div role="alert" className="rounded-lg border border-[#F04438]/30 bg-[#FEF3F2] px-4 py-3 text-[#B42318] flex justify-between"><span>{error}</span><button onClick={load} className="font-label-sm underline">Retry</button></div>}
    {loading && <div className="flex justify-center py-16 text-[#44474d]"><Loader2 size={22} className="animate-spin mr-2" /> Loading orders…</div>}
    {!loading && !error && <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left min-w-[700px]"><thead><tr className="bg-[#f0f3ff]">{["Order #", "Date", "Items", "Total", "Status", ""].map((h) => <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#E4E7EC]">{visible.map((order) => <tr key={order.id} className="hover:bg-[#f0f3ff]/50 transition-colors"><td className="py-3 px-5"><Link href={`/portal/orders/${order.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{order.orderNumber}</Link></td><td className="py-3 px-5 font-body-sm text-[#44474d]">{order.createdAt.split("T")[0]}</td><td className="py-3 px-5 font-body-sm text-[#111c2d]">{order.items.length}</td><td className="py-3 px-5 font-mono-label text-[#111c2d] font-medium">{money(order.total, order.currency)}</td><td className="py-3 px-5"><StatusBadge status={order.status.toLowerCase()} /></td><td className="py-3 px-5"><Link href={`/portal/orders/${order.id}`} className="font-label-sm text-[#1769E0] hover:underline text-xs">View</Link></td></tr>)}{visible.length === 0 && <tr><td colSpan={6} className="py-12 text-center font-body-md text-[#44474d]">No orders found.</td></tr>}</tbody></table></div></div>}
  </div>;
}
