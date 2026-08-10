import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTABanner() {
  return (
    <section className="py-20 px-4 md:px-8 bg-[#1769E0]">
      <div className="max-w-[1280px] mx-auto text-center">
        <h2 className="font-display-lg text-white mb-4">Ready to Streamline Your Procurement?</h2>
        <p className="font-body-lg text-white/80 mb-8 max-w-2xl mx-auto">
          Submit your BOM or part list and our team will source, verify, and deliver to your door.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/request-quote"
            className="bg-white text-[#1769E0] px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#f0f3ff] transition-colors flex items-center gap-2"
          >
            Request a Quote <ArrowRight size={18} />
          </Link>
          <Link
            href="/login"
            className="bg-white/10 text-white border border-white/30 px-8 py-4 rounded-lg font-label-md hover:bg-white/20 transition-colors"
          >
            Customer Login
          </Link>
        </div>
      </div>
    </section>
  );
}