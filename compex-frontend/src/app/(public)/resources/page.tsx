import type { Metadata } from "next";
import { BookOpen, Cpu, FileText, Plane, Zap } from "lucide-react";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Electronic Component Sourcing Resources | Compex Solution",
  description: "Guides and information on BOM sourcing, component selection, procurement, and import logistics for electronic manufacturing in India.",
};

const resources = [
  {
    icon: FileText,
    category: "Procurement",
    title: "BOM Sourcing Guide",
    desc: "How to prepare a Bill of Materials for global sourcing: format requirements, part number conventions, and how Compex processes your BOM.",
  },
  {
    icon: Cpu,
    category: "Engineering",
    title: "Component Selection",
    desc: "Key factors to consider when selecting electronic components: datasheet reading, package compatibility, lifecycle status, and alternative sourcing.",
  },
  {
    icon: BookOpen,
    category: "Procurement",
    title: "Procurement Guide",
    desc: "An introduction to electronic component procurement for Indian manufacturers: global supply chains, lead times, and cost drivers.",
  },
  {
    icon: Plane,
    category: "Logistics",
    title: "Import & Logistics",
    desc: "Understanding customs classification, import duties, BIS requirements, and incoterms for electronic component imports into India.",
  },
  {
    icon: Zap,
    category: "Knowledge",
    title: "Component Knowledge Base",
    desc: "Reference information on common component families: ICs, passives, power semiconductors, connectors, and sensors.",
  },
];

export default function ResourcesPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Resources</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Sourcing Knowledge &amp; Procurement Guides
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Reference material for procurement teams and design engineers working with electronic components.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((res) => (
              <div key={res.title} className="bg-white border border-[#E4E7EC] rounded-xl p-6 hover:border-[#1769E0] hover:shadow-md transition-all flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#e8eeff] flex items-center justify-center shrink-0">
                    <res.icon size={20} className="text-[#1769E0]" />
                  </div>
                  <span className="font-label-sm text-[#1769E0] uppercase tracking-wide mt-2">{res.category}</span>
                </div>
                <h2 className="font-headline-sm text-[#0B1F3A] mb-2">{res.title}</h2>
                <p className="font-body-md text-[#44474d] flex-1">{res.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center font-body-sm text-[#44474d]/70 mt-12">
            Full article content coming soon. Contact our team for specific sourcing and procurement guidance.
          </p>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}