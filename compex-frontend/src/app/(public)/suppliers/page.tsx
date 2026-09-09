import type { Metadata } from "next";
import Link from "next/link";
import { Globe2, ShieldCheck, Network } from "lucide-react";
import CTABanner from "@/components/ui/CTABanner";

export const metadata: Metadata = {
  title: "Global Sourcing Network | Compex Solution",
  description: "Compex Solution sources electronic components through a verified network of authorized global distribution channels.",
};

const channels = [
  {
    name: "Mouser Electronics",
    role: "Authorized global distributor",
    desc: "New, factory-original components sourced direct from manufacturer-authorized stock.",
  },
  {
    name: "DigiKey",
    role: "Authorized global distributor",
    desc: "Broad-line distributor coverage across semiconductors, passives, and interconnect.",
  },
  {
    name: "element14 / Farnell",
    role: "Authorized global distributor",
    desc: "Manufacturer-authorized distribution with engineering-grade documentation.",
  },
];

const principles = [
  {
    icon: ShieldCheck,
    title: "Authorized channels only",
    desc: "We source through manufacturer-authorized distribution — not grey-market or unverified brokers — to keep parts traceable and genuine.",
  },
  {
    icon: Network,
    title: "Multi-channel verification",
    desc: "Every exact-MPN search checks multiple channels in parallel, so you see real-time part availability across our network, not a single source.",
  },
  {
    icon: Globe2,
    title: "Commercial terms stay with Compex",
    desc: "You request a quote from Compex; we handle sourcing, pricing, and procurement across the network on your behalf. We never publish channel-side pricing, stock, or MOQ.",
  },
];

export default function SuppliersPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Sourcing Network</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            A Verified, Multi-Channel Sourcing Network
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Compex Solution does not run an open supplier marketplace. We source on your behalf through
            a small set of authorized global distribution channels, verify part identity, and manage the
            full procurement relationship — so you deal with one point of contact, not many suppliers.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">Channels in Our Network</h2>
            <p className="font-body-lg text-[#44474d] max-w-2xl mx-auto">
              These are the authorized distribution channels our exact-MPN search already checks in real time.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {channels.map((ch) => (
              <div key={ch.name} className="bg-white border border-[#E4E7EC] rounded-xl p-6">
                <span className="tag mb-4">{ch.role}</span>
                <h3 className="font-headline-sm text-[#0B1F3A] mb-2">{ch.name}</h3>
                <p className="font-body-sm text-[#44474d]">{ch.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-3">How the Network Works for You</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {principles.map((p) => (
              <div key={p.title} className="bg-white border border-[#E4E7EC] rounded-xl p-6">
                <div className="w-10 h-10 rounded-lg bg-[#e8eeff] flex items-center justify-center mb-4">
                  <p.icon size={20} className="text-[#1769E0]" />
                </div>
                <h3 className="font-label-md text-[#0B1F3A] mb-2">{p.title}</h3>
                <p className="font-body-sm text-[#44474d]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-4">Have a part number in mind?</h2>
          <p className="font-body-lg text-[#44474d] mb-8 max-w-2xl mx-auto">
            Search an exact MPN to see live availability across our sourcing network.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors"
          >
            Search a Component
          </Link>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
