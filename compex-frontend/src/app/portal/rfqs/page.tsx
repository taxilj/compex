import Link from "next/link";
import { rfqs } from "@/data/mock/rfqs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Plus, Clock } from "lucide-react";

export default function RFQsPage() {
  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">My RFQs</h1>
          <p className="font-body-md text-[#44474d] mt-1">{rfqs.length} total requests</p>
        </div>
        <Link href="/portal/rfqs/new" className="flex items-center gap-2 bg-[#0B1F3A] text-white px-5 py-2.5 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors">
          <Plus size={18} /> New RFQ
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#f0f3ff]">
                {["RFQ #", "Date", "Items", "City", "Required Date", "Status", ""].map((h) => (
                  <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {rfqs.map((rfq) => (
                <tr key={rfq.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                  <td className="py-3 px-5">
                    <Link href={`/portal/rfqs/${rfq.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{rfq.number}</Link>
                  </td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d]">{rfq.createdAt.split("T")[0]}</td>
                  <td className="py-3 px-5 font-body-sm text-[#111c2d]">{rfq.items.length}</td>
                  <td className="py-3 px-5 font-body-sm text-[#111c2d]">{rfq.deliveryCity}</td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d] flex items-center gap-1"><Clock size={14} /> {rfq.requiredDate}</td>
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
    </div>
  );
}