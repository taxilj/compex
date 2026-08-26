"use client";

import Link from "next/link";
import { useRef, useLayoutEffect } from "react";
import { ArrowRight, Upload, Search, ShieldCheck, Truck, Package } from "lucide-react";
import gsap from "gsap";

export function HeroSection() {
  const floatRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!floatRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(".hero-visual-inner", { y: -14, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".hero-float-1", { y: -8, duration: 2.5, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.4 });
      gsap.to(".hero-float-2", { y: -10, duration: 3.8, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1 });
    }, floatRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative w-full pt-24 pb-28 lg:pt-32 lg:pb-36 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#f0f4ff] via-white to-[#eef6ff]" />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.12]"
          style={{ background: "radial-gradient(circle, #1769E0 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 -right-56 w-[600px] h-[600px] rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #0B1F3A 0%, transparent 70%)" }} />
      </div>

      <div className="max-w-[1280px] mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-7">
          <div className="anim-hero-1 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#1769E0]/10 border border-[#1769E0]/20">
            <span className="w-2 h-2 rounded-full bg-[#1769E0] animate-pulse" />
            <span className="font-mono-label text-[#1769E0] text-sm tracking-widest uppercase">Enterprise Procurement</span>
          </div>

          <h1 className="font-display-lg text-[#0B1F3A] leading-tight">
            <div className="anim-hero-2 block">Global Electronic</div>
            <div className="anim-hero-3 block">Component Sourcing.</div>
            <div className="anim-hero-4 block text-[#1769E0]">Delivered Across India.</div>
          </h1>

          <p className="anim-hero-5 font-body-lg text-[#44474d] max-w-2xl">
            Streamline your supply chain with direct access to global manufacturers and authorized distributors. We handle bulk procurement, customs clearance, and secure domestic delivery.
          </p>

          <form action="/products" method="GET" className="anim-hero-6 w-full max-w-xl bg-white p-2 rounded-2xl shadow-md border border-[#E4E7EC] flex items-center gap-2">
            <div className="flex-1 flex items-center px-4 py-2.5 gap-3">
              <Search size={18} className="text-[#75777e] shrink-0" />
              <input
                name="q"
                className="w-full bg-transparent border-none outline-none font-body-md text-[#111c2d] placeholder:text-[#75777e]"
                placeholder="Search by MPN, Part Number..."
              />
            </div>
            <button
              type="submit"
              className="bg-[#0B1F3A] hover:bg-[#1769E0] text-white px-6 py-3 rounded-xl font-label-md transition-all duration-300 flex items-center gap-2 whitespace-nowrap"
            >
              Search <ArrowRight size={16} />
            </button>
          </form>

          <p className="anim-hero-7 font-body-sm text-[#44474d]/60">
            Try:{" "}
            <Link href="/products/STM32F103C8T6" className="text-[#1769E0] hover:underline font-mono-label">STM32F103C8T6</Link>
            {" · "}
            <Link href="/products?q=Texas+Instruments" className="text-[#1769E0] hover:underline font-mono-label">Texas Instruments</Link>
          </p>

          <div className="anim-hero-8 flex flex-wrap gap-4 pt-1">
            <Link
              href="/request-quote"
              className="group bg-[#1769E0] text-white px-8 py-4 rounded-xl font-label-md font-bold uppercase tracking-wide hover:bg-[#1257b8] transition-all duration-300 flex items-center gap-2 shadow-md shadow-[#1769E0]/25 hover:shadow-lg hover:shadow-[#1769E0]/35 hover:-translate-y-0.5"
            >
              Request a Quote
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
            <Link href="/request-quote?mode=bom" className="group bg-white border-2 border-[#0B1F3A] text-[#0B1F3A] px-8 py-4 rounded-xl font-label-md font-bold uppercase tracking-wide hover:bg-[#0B1F3A] hover:text-white transition-all duration-300 flex items-center gap-2 hover:-translate-y-0.5">
              <Upload size={18} />
              BOM Enquiry
            </Link>
          </div>
        </div>

        <div ref={floatRef} className="lg:col-span-5 relative hidden lg:flex items-center justify-center">
          <div className="anim-hero-visual relative">
            <div className="hero-visual-inner w-[320px] h-[390px] rounded-3xl overflow-hidden shadow-2xl shadow-[#0B1F3A]/20 bg-gradient-to-br from-[#0B1F3A] via-[#122d56] to-[#1769E0] relative">
              <div className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
                  backgroundSize: "36px 36px",
                }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8">
                <div className="w-20 h-20 rounded-2xl bg-white/[0.12] backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Package size={36} className="text-white" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-2xl leading-tight">15,000+</p>
                  <p className="font-body-md text-white/70 mt-1">Components sourced globally</p>
                </div>
                <div className="w-full space-y-3 mt-2">
                  {[
                    { label: "Asia Pacific", pct: 82 },
                    { label: "Europe", pct: 65 },
                    { label: "Americas", pct: 48 },
                  ].map(({ label, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-white/60 mb-1.5">
                        <span>{label}</span><span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-white/70 to-white/40 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero-float-1 absolute -left-14 top-10 bg-white p-4 rounded-2xl shadow-xl border border-[#E4E7EC] flex items-center gap-3 min-w-[210px]">
              <div className="w-10 h-10 rounded-full bg-[#12B76A]/10 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} className="text-[#12B76A]" />
              </div>
              <div>
                <p className="font-label-sm text-[#44474d] uppercase tracking-wide">Verified Parts</p>
                <p className="font-label-md text-[#111c2d] font-semibold">15,000 Units Secured</p>
              </div>
            </div>

            <div className="hero-float-2 absolute -right-14 bottom-14 bg-white p-4 rounded-2xl shadow-xl border border-[#E4E7EC] flex items-center gap-3 min-w-[210px]">
              <div className="w-10 h-10 rounded-full bg-[#1769E0]/10 flex items-center justify-center shrink-0">
                <Truck size={20} className="text-[#1769E0]" />
              </div>
              <div>
                <p className="font-label-sm text-[#44474d] uppercase tracking-wide">Delivery ETA</p>
                <p className="font-label-md text-[#111c2d] font-semibold">Bangalore · 4 Days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
