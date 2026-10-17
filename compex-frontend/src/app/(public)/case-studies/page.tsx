import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/site";
import { Factory, Car, Cpu, Shield } from "lucide-react";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = pageMetadata({
  title: "Example Sourcing Scenarios | Compex Solution",
  description: "Illustrative examples of the sourcing and procurement challenges Compex Solution can help industrial and electronics manufacturers with. Not customer case histories.",
  path: "/case-studies",
});

// A Next.js page file may only export route fields, so this stays module-private.
const DISCLAIMER =
  "These are illustrative scenarios, not customer case histories. They name no clients and state no quantities, timelines or results.";

// Every entry is a generic scenario written for this page. None describes a real customer, order or
// outcome, so none states a figure, a delivery time or a guaranteed result.
const scenarios = [
  {
    icon: Factory,
    industry: "Industrial Automation",
    title: "Example scenario: sourcing a controller bill of materials",
    challenge: "A machine builder has a bill of materials for a controller board and needs every line priced and sourced against a production date.",
    approach: "Compex would review the BOM, check each manufacturer part number, ask suppliers for availability and pricing, and return a single consolidated quotation for review.",
    ask: "A line-by-line quotation, noting which parts are available, which are not, and any suggested alternatives for you to approve.",
  },
  {
    icon: Car,
    industry: "Automotive Electronics",
    title: "Example scenario: prototype quantities of automotive-grade parts",
    challenge: "An engineering team needs small prototype quantities of automotive-grade sensors and microcontrollers for evaluation.",
    approach: "Compex would look for stock at manufacturer-authorised sources and describe the import documents needed, so the team can decide before ordering.",
    ask: "Availability and lead-time information per part, and a quotation if a part is available at the quantity you need.",
  },
  {
    icon: Cpu,
    industry: "Consumer Electronics",
    title: "Example scenario: a hard-to-find microcontroller family",
    challenge: "A product company is struggling to find stock of a specific microcontroller family during a period of tight supply.",
    approach: "Compex would search its supplier network for available inventory and report what was found, including date codes where a supplier provides them.",
    ask: "A list of what is currently available and from which source type, so you can judge whether it suits your quality requirements.",
  },
  {
    icon: Shield,
    industry: "Defense Electronics",
    title: "Example scenario: a discontinued component for a legacy system",
    challenge: "An electronics manufacturer needs a discontinued component to repair or support a legacy system.",
    approach: "Compex would approach suppliers that handle end-of-life parts and share what documentation each can offer. Availability of any given part cannot be promised.",
    ask: "An honest report of whether the part can be found, with the documentation and testing options suppliers offer, for you to decide.",
  },
];

export default function CaseStudiesPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Example Scenarios</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Illustrative Sourcing Scenarios
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Examples of the kinds of sourcing and procurement challenges Compex Solution can help manufacturing customers across India with.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto space-y-8">
          <p role="note" className="rounded-lg border border-[#E4E7EC] bg-[#f9f9ff] px-5 py-4 font-body-md text-[#44474d]">
            {DISCLAIMER}
          </p>
          {scenarios.map((scenario) => (
            <div key={scenario.title} className="bg-white border border-[#E4E7EC] rounded-xl p-8 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#e8eeff] flex items-center justify-center">
                  <scenario.icon size={20} className="text-[#1769E0]" />
                </div>
                <span className="font-label-sm text-[#1769E0] uppercase tracking-wide">{scenario.industry}</span>
              </div>
              <h2 className="font-headline-md text-[#0B1F3A] mb-6">{scenario.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-label-md text-[#44474d] uppercase tracking-wide mb-2">Scenario</h3>
                  <p className="font-body-md text-[#111c2d]">{scenario.challenge}</p>
                </div>
                <div>
                  <h3 className="font-label-md text-[#44474d] uppercase tracking-wide mb-2">How we would approach it</h3>
                  <p className="font-body-md text-[#111c2d]">{scenario.approach}</p>
                </div>
                <div>
                  <h3 className="font-label-md text-[#44474d] uppercase tracking-wide mb-2">What you can ask for</h3>
                  <p className="font-body-md text-[#111c2d]">{scenario.ask}</p>
                </div>
              </div>
            </div>
          ))}
          <p className="font-body-md text-[#44474d]">
            Have a real requirement? <Link href="/request-quote" className="text-[#1769E0] hover:underline">Request a quote</Link> or{" "}
            <Link href="/contact" className="text-[#1769E0] hover:underline">contact the sales team</Link>.
          </p>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
