import type { Metadata } from "next";
import { Factory, Car, Cpu, Shield } from "lucide-react";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Case Studies | Compex Solution",
  description: "Example sourcing and procurement projects handled by Compex Solution for industrial and electronics manufacturers across India.",
};

const caseStudies = [
  {
    icon: Factory,
    industry: "Industrial Automation",
    title: "Example Project: PLC Controller BOM Sourcing",
    challenge: "A machine builder needed to source 47 line items for a production batch of PLC-based controllers with a 6-week delivery window.",
    solution: "Compex sourced all line items from three different global distributors, consolidated the shipment, and managed customs clearance.",
    result: "Full BOM delivered within the required window. All components arrived with full traceability documentation.",
  },
  {
    icon: Car,
    industry: "Automotive Electronics",
    title: "Example Project: ADAS Prototype Components",
    challenge: "An automotive tier-1 supplier needed prototype quantities of specialized automotive-grade sensors and microcontrollers.",
    solution: "We identified availability at OCM-authorized sources and managed the import with the required documentation for automotive traceability.",
    result: "Prototype components delivered for evaluation. Follow-on production volume quotation provided.",
  },
  {
    icon: Cpu,
    industry: "Consumer Electronics",
    title: "Example Project: Microcontroller Shortage Sourcing",
    challenge: "During an industry-wide supply shortage, a product company needed to secure stock of a specific MCU family to maintain production.",
    solution: "Compex identified available inventory across multiple global channels and procured verified stock with datecodes within specification.",
    result: "Production continuity maintained for the customer through the shortage period.",
  },
  {
    icon: Shield,
    industry: "Defense Electronics",
    title: "Example Project: Obsolete Component Procurement",
    challenge: "A defense electronics OEM required a discontinued component for a legacy system repair program.",
    solution: "Compex sourced original stock from specialist obsolete component brokers with full traceability and testing verification.",
    result: "Genuine parts sourced and delivered with traceability documentation to support the customer's quality requirements.",
  },
];

export default function CaseStudiesPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Case Studies</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Sourcing Projects &amp; Example Work
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Illustrative examples of the types of sourcing and procurement challenges Compex Solution addresses for manufacturing customers across India.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto space-y-8">
          {caseStudies.map((cs) => (
            <div key={cs.title} className="bg-white border border-[#E4E7EC] rounded-xl p-8 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#e8eeff] flex items-center justify-center">
                  <cs.icon size={20} className="text-[#1769E0]" />
                </div>
                <span className="font-label-sm text-[#1769E0] uppercase tracking-wide">{cs.industry}</span>
              </div>
              <h2 className="font-headline-md text-[#0B1F3A] mb-6">{cs.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-label-md text-[#44474d] uppercase tracking-wide mb-2">Challenge</h3>
                  <p className="font-body-md text-[#111c2d]">{cs.challenge}</p>
                </div>
                <div>
                  <h3 className="font-label-md text-[#44474d] uppercase tracking-wide mb-2">Solution</h3>
                  <p className="font-body-md text-[#111c2d]">{cs.solution}</p>
                </div>
                <div>
                  <h3 className="font-label-md text-[#44474d] uppercase tracking-wide mb-2">Result</h3>
                  <p className="font-body-md text-[#111c2d]">{cs.result}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CTABanner />
    </div>
  );
}