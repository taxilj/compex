import type { Metadata } from "next";
import Link from "next/link";
import { Upload, ListPlus, LogIn } from "lucide-react";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "BOM Management | Compex Solution",
  description: "Submit a Bill of Materials for sourcing, or manage parsed BOM uploads inside your Compex customer portal.",
};

const paths = [
  {
    icon: ListPlus,
    title: "Submit a BOM enquiry",
    desc: "No account needed. Enter your line items — MPN, manufacturer, description, and quantity — and our sourcing team follows up with a quote.",
    action: { href: "/request-quote?mode=bom", label: "Start BOM Enquiry" },
  },
  {
    icon: LogIn,
    title: "Upload & track a parsed BOM",
    desc: "Customer portal accounts can upload a BOM file directly, have it parsed into line items automatically, and track sourcing status per line.",
    action: { href: "/login", label: "Log In to Portal" },
  },
];

export default function BomToolPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Tools · BOM Management</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Source Your Full Bill of Materials
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Two ways to get a BOM sourced, depending on whether you have a Compex account.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {paths.map((p) => (
            <div key={p.title} className="bg-white border border-[#E4E7EC] rounded-xl p-8 flex flex-col">
              <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center mb-5">
                <p.icon size={22} className="text-[#1769E0]" />
              </div>
              <h2 className="font-headline-sm text-[#0B1F3A] mb-2">{p.title}</h2>
              <p className="font-body-sm text-[#44474d] mb-6 flex-1">{p.desc}</p>
              <Link
                href={p.action.href}
                className="inline-flex items-center justify-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded font-label-md hover:bg-[#1257b8] transition-colors"
              >
                <Upload size={16} /> {p.action.label}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
