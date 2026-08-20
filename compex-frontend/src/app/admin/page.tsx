import Link from "next/link";
import { FileText, ClipboardList, Package, DollarSign, AlertCircle, CheckSquare, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { tasks } from "@/data/mock/tasks";
import { orders } from "@/data/mock/orders";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RecentRfqsTable } from "./RecentRfqsTable";

const adminStats = [
  { label: "New RFQs (Today)", value: 3, icon: FileText, trend: "+2", up: true, iconBg: "bg-[#e8eeff]", iconColor: "text-[#0B1F3A]" },
  { label: "Open RFQs", value: 12, icon: AlertCircle, trend: "8 need attention", up: false, iconBg: "bg-[#F79009]/10", iconColor: "text-[#F79009]" },
  { label: "Quotes Pending", value: 5, icon: ClipboardList, trend: "Avg 2.1d", up: true, iconBg: "bg-[#23597F]/10", iconColor: "text-[#23597F]" },
  { label: "Orders Processing", value: 8, icon: Package, trend: "+1 today", up: true, iconBg: "bg-[#1769E0]/10", iconColor: "text-[#1769E0]" },
  { label: "Pending Payments", value: "₹24.5L", icon: DollarSign, trend: "3 overdue", up: false, iconBg: "bg-[#F04438]/10", iconColor: "text-[#F04438]" },
  { label: "Open Tasks", value: 6, icon: CheckSquare, trend: "2 urgent", up: false, iconBg: "bg-[#12B76A]/10", iconColor: "text-[#12B76A]" },
];

const chartBars = [
  { label: "Mon", rfq: 4, sales: 2 },
  { label: "Tue", rfq: 7, sales: 5 },
  { label: "Wed", rfq: 5, sales: 3 },
  { label: "Thu", rfq: 9, sales: 7 },
  { label: "Fri", rfq: 6, sales: 4 },
  { label: "Sat", rfq: 3, sales: 2 },
  { label: "Sun", rfq: 8, sales: 6 },
];

const maxVal = Math.max(...chartBars.map((b) => Math.max(b.rfq, b.sales)));

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Operations Dashboard</h1>
          <p className="font-body-md text-[#44474d] mt-1">
            Live overview — <span className="text-[#F04438] font-label-md">Demo data only</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-[#12B76A] rounded-full animate-pulse" />
          <span className="font-label-sm text-[#12B76A]">Live</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminStats.map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-lg border border-[#E4E7EC] shadow-sm flex flex-col hover:-translate-y-0.5 transition-transform duration-300">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded ${stat.iconBg}`}>
                <stat.icon size={20} className={stat.iconColor} />
              </div>
            </div>
            <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="font-headline-lg text-[#111c2d]">{stat.value}</h3>
              <span className={`flex items-center text-xs font-medium ${stat.up ? "text-[#12B76A]" : "text-[#F04438]"}`}>
                {stat.up ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts + table row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* RFQ Volume chart */}
        <div className="xl:col-span-1 bg-white rounded-lg border border-[#E4E7EC] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-sm text-[#111c2d]">Weekly Activity</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#0B1F3A] inline-block" /> RFQs</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#1769E0] inline-block" /> Sales</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-32">
            {chartBars.map((bar) => (
              <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-24">
                  <div
                    className="flex-1 bg-[#0B1F3A] rounded-sm min-h-[2px]"
                    style={{ height: `${(bar.rfq / maxVal) * 100}%` }}
                  />
                  <div
                    className="flex-1 bg-[#1769E0] rounded-sm min-h-[2px]"
                    style={{ height: `${(bar.sales / maxVal) * 100}%` }}
                  />
                </div>
                <span className="font-label-sm text-[#44474d] text-[10px]">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        <RecentRfqsTable />
      </div>

      {/* Tasks + Orders */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pending Tasks */}
        <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-sm text-[#111c2d]">Pending Tasks</h3>
            <span className="bg-[#F04438]/10 text-[#F04438] px-2 py-0.5 rounded font-label-sm text-xs">
              {tasks.filter((t) => !t.completed && t.priority === "high").length} urgent
            </span>
          </div>
          <div className="space-y-3">
            {tasks.filter((t) => !t.completed).map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded border border-[#E4E7EC] hover:bg-[#f0f3ff]/50 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${task.priority === "high" ? "bg-[#F04438]" : task.priority === "medium" ? "bg-[#F79009]" : "bg-[#12B76A]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-[#111c2d] text-sm">{task.title}</p>
                  <p className="font-body-sm text-[#44474d] text-xs">{task.assignedTo} · Due {task.dueDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-sm text-[#111c2d]">Recent Orders</h3>
            <Link href="/admin/orders" className="font-label-md text-[#1769E0] hover:underline text-sm flex items-center gap-1">
              View All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center gap-4 p-3 rounded border border-[#E4E7EC]">
                <div className="flex-1 min-w-0">
                  <p className="font-mono-label text-[#0B1F3A] font-medium text-sm">{order.number}</p>
                  <p className="font-body-sm text-[#44474d] text-xs truncate">{order.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono-label text-[#111c2d] text-sm">₹{(order.grandTotal / 100000).toFixed(1)}L</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}