import type { Metadata } from "next";
import Link from "next/link";
import { FileText, LogIn, ArrowRight } from "lucide-react";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Request for Quote | Compex Solution",
  description: "Submit a formal Request for Quote for specific electronic component line items.",
};

const steps = [
  { step: "01", title: "Add line items", desc: "Enter MPN, manufacturer, description, and quantity for each component you need." },
  { step: "02", title: "Submit your requirement", desc: "Our sourcing team checks availability across the network and prepares pricing." },
  { step: "03", title: "Receive your quote", desc: "Customers with a portal account can track RFQ status and view quotations online." },
];

export default function RfqToolPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Tools · Request for Quote</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Submit a Request for Quote
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl mb-8">
            Tell us the parts you need and we&apos;ll return sourcing and pricing across our verified distribution network.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/request-quote"
              className="bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors flex items-center gap-2"
            >
              Start an RFQ <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="bg-white/10 text-white border border-white/20 px-8 py-4 rounded-lg font-label-md hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <LogIn size={18} /> Track Existing RFQs
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">How It Works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="border-t-2 border-[#0B1F3A] pt-4">
                <span className="font-mono-label text-[#1769E0]">{s.step}</span>
                <h3 className="font-headline-sm text-[#0B1F3A] mt-2 mb-2">{s.title}</h3>
                <p className="font-body-sm text-[#44474d]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto text-center">
          <div className="w-12 h-12 rounded-lg bg-[#e8eeff] flex items-center justify-center mx-auto mb-5">
            <FileText size={22} className="text-[#1769E0]" />
          </div>
          <h2 className="font-headline-lg text-[#0B1F3A] mb-4">Sourcing a full BOM instead?</h2>
          <p className="font-body-lg text-[#44474d] mb-8 max-w-2xl mx-auto">
            Use the dedicated BOM tool for multi-line-item requirements.
          </p>
          <Link
            href="/tools/bom"
            className="inline-flex items-center gap-2 border border-[#0B1F3A] text-[#0B1F3A] px-8 py-4 rounded-lg font-label-md hover:bg-[#0B1F3A] hover:text-white transition-colors"
          >
            Go to BOM Management
          </Link>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
