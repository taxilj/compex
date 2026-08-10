import Link from "next/link";
import { FileText, ClipboardList, Package, DollarSign, ArrowUpRight, Clock } from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { rfqs } from "@/data/mock/rfqs";

export default function PortalDashboardPage() {
  const recentRFQs = rfqs.slice(0, 4);

  return (
    <div className="space-y-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-[#111c2d] mb-2">Welcome back, TechCorp</h1>
          <p className="font-body-md text-[#44474d]">Here is the latest overview of your procurement activities.</p>
        </div>
        <Link
          href="/request-quote"
          className="bg-[#0B1F3A] text-white px-6 py-3 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors flex items-center gap-2 w-fit"
        >
          + New RFQ
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Open RFQs" value={3} icon={FileText} trend="↑ 2 from last week" trendUp />
        <StatsCard label="Quotes Ready" value={1} icon={ClipboardList} iconClassName="bg-[#12B76A]/10" trend="Review now" trendUp />
        <StatsCard label="Active Orders" value={2} icon={Package} iconClassName="bg-[#1769E0]/10" />
        <StatsCard label="Pending Payments" value="₹4.0L" icon={DollarSign} iconClassName="bg-[#F79009]/10" trend="Due in 5 days" trendUp={false} />
      </div>

      {/* Recent RFQs */}
      <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm">
        <div className="p-5 border-b border-[#E4E7EC] flex items-center justify-between">
          <h2 className="font-headline-sm text-[#111c2d]">Recent RFQs</h2>
          <Link href="/portal/rfqs" className="font-label-md text-[#1769E0] hover:underline text-sm flex items-center gap-1">
            View All <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-[#f0f3ff]">
                {["RFQ #", "Items", "City", "Required Date", "Status", "Action"].map((h) => (
                  <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {recentRFQs.map((rfq) => (
                <tr key={rfq.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                  <td className="py-3 px-5">
                    <Link href={`/portal/rfqs/${rfq.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">
                      {rfq.number}
                    </Link>
                  </td>
                  <td className="py-3 px-5 font-body-sm text-[#111c2d]">{rfq.items.length} items</td>
                  <td className="py-3 px-5 font-body-sm text-[#111c2d]">{rfq.deliveryCity}</td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d] flex items-center gap-1">
                    <Clock size={14} /> {rfq.requiredDate}
                  </td>
                  <td className="py-3 px-5"><StatusBadge status={rfq.status} /></td>
                  <td className="py-3 px-5">
                    <Link href={`/portal/rfqs/${rfq.id}`} className="font-label-sm text-[#1769E0] hover:underline text-xs">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity */}
      <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm p-6">
        <h2 className="font-headline-sm text-[#111c2d] mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { text: "Quote QT-4521 is ready for your review", time: "2 hours ago", color: "bg-[#12B76A]" },
            { text: "RFQ RQ-8924 moved to Sourcing stage", time: "5 hours ago", color: "bg-[#1769E0]" },
            { text: "Order ORD-2024 shipped via DHL Express", time: "Yesterday", color: "bg-[#1769E0]" },
            { text: "Invoice INV-2024-089 marked as paid", time: "2 days ago", color: "bg-[#12B76A]" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${item.color}`} />
              <div>
                <p className="font-body-sm text-[#111c2d]">{item.text}</p>
                <p className="font-body-sm text-[#44474d] text-xs mt-0.5">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}