import Link from "next/link";
import { quotes } from "@/data/mock/quotes";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function QuotesPage() {
  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Quotes</h1>
          <p className="font-body-md text-[#44474d] mt-1">{quotes.length} quotations</p>
        </div>
        <Link
          href="/portal/quotes/compare"
          className="border border-[#E4E7EC] text-[#44474d] px-4 py-2 rounded font-label-md hover:bg-[#f0f3ff] transition-colors"
        >
          Compare Quotes
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#f0f3ff]">
                {["Quote #", "RFQ", "Date", "Items", "Grand Total", "Valid Until", "Status", ""].map((h) => (
                  <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                  <td className="py-3 px-5"><Link href={`/portal/quotes/${q.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{q.number}</Link></td>
                  <td className="py-3 px-5 font-mono-label text-[#44474d]">{q.rfqNumber}</td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d]">{q.createdAt.split("T")[0]}</td>
                  <td className="py-3 px-5 font-body-sm text-[#111c2d]">{q.items.length}</td>
                  <td className="py-3 px-5 font-mono-label text-[#111c2d] font-medium">₹{q.grandTotal.toLocaleString()}</td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d]">{q.validUntil}</td>
                  <td className="py-3 px-5"><StatusBadge status={q.status} /></td>
                  <td className="py-3 px-5"><Link href={`/portal/quotes/${q.id}`} className="font-label-sm text-[#1769E0] hover:underline text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}