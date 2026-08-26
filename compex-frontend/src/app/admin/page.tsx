import Link from "next/link";
import { ArrowUpRight, Building, ClipboardList, FileText, Settings, Users } from "lucide-react";
import { RecentRfqsTable } from "./RecentRfqsTable";

const liveAreas = [
  { href: "/admin/rfqs", label: "RFQ Management", description: "Review submitted requirements and move valid RFQs into sourcing.", icon: FileText },
  { href: "/admin/leads", label: "Website Enquiries", description: "Review persisted contact, quote, and BOM enquiries.", icon: ClipboardList },
  { href: "/admin/quotes", label: "Customer Quotations", description: "Review quotations created from approved sourcing data.", icon: ClipboardList },
  { href: "/admin/vendors", label: "Vendors", description: "View the live sourcing-vendor directory.", icon: Users },
  { href: "/admin/organization", label: "Organization", description: "Maintain legal, banking, and document-prefix master data.", icon: Building },
  { href: "/admin/settings", label: "Settings", description: "Maintain editable master-data values.", icon: Settings },
];

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <div>
        <h1 className="font-headline-lg text-[#111c2d]">Operations Dashboard</h1>
        <p className="mt-1 font-body-md text-[#44474d]">Live operational areas backed by the Compex API.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {liveAreas.map((area) => (
          <Link key={area.href} href={area.href} className="group rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1769E0]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1769E0]">
            <div className="mb-4 flex items-start justify-between">
              <span className="rounded-lg bg-[#e8eeff] p-2 text-[#1769E0]"><area.icon size={20} /></span>
              <ArrowUpRight size={17} className="text-[#667085] transition group-hover:text-[#1769E0]" />
            </div>
            <h2 className="font-headline-sm text-[#111c2d]">{area.label}</h2>
            <p className="mt-2 font-body-sm text-[#44474d]">{area.description}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1">
        <RecentRfqsTable />
      </div>
    </div>
  );
}
