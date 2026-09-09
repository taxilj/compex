import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, FileText, ListChecks, Calculator, ArrowRight } from "lucide-react";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Engineering & Sourcing Tools | Compex Solution",
  description: "BOM management, RFQ submission, multi-part search, and engineering calculators for electronic component sourcing.",
};

const tools = [
  {
    href: "/tools/bom",
    icon: FileSpreadsheet,
    title: "BOM Management",
    who: "For engineers with a complete Bill of Materials",
    desc: "Submit a full BOM for sourcing, or manage parsed BOM uploads inside your customer portal once logged in.",
  },
  {
    href: "/tools/rfq",
    icon: FileText,
    title: "Request for Quote",
    who: "For buyers ready to source specific line items",
    desc: "Build and submit a formal RFQ. Logged-in customers can track RFQ status end to end in the portal.",
  },
  {
    href: "/tools/search-multiple",
    icon: ListChecks,
    title: "Search Multiple Parts",
    who: "For engineers checking availability on a part list",
    desc: "Paste a list of exact MPNs and get manufacturer, category, package, and datasheet status for each in one pass.",
  },
  {
    href: "/tools/calculators",
    icon: Calculator,
    title: "Engineering Calculators",
    who: "For quick reference during design work",
    desc: "Ohm's Law and unit-conversion calculators for everyday component-selection math.",
  },
];

export default function ToolsPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Tools</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Engineering & Sourcing Toolkit
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Practical tools for the sourcing workflow — from a single part number to a full Bill of Materials.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group bg-white border border-[#E4E7EC] rounded-xl p-8 hover:border-[#1769E0] hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center mb-5">
                <tool.icon size={22} className="text-[#1769E0]" />
              </div>
              <h2 className="font-headline-sm text-[#0B1F3A] mb-1.5">{tool.title}</h2>
              <p className="font-mono-label text-[#75777e] mb-3">{tool.who}</p>
              <p className="font-body-sm text-[#44474d] mb-5">{tool.desc}</p>
              <span className="font-label-md text-[#1769E0] flex items-center gap-2 group-hover:gap-3 transition-all">
                Open tool <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
