const manufacturers = [
  "STMicroelectronics",
  "Texas Instruments",
  "NXP Semiconductors",
  "Infineon Technologies",
  "Microchip Technology",
  "Renesas Electronics",
  "Nordic Semiconductor",
  "Qualcomm",
  "Analog Devices",
  "ON Semiconductor",
  "Vishay Intertechnology",
  "Murata Manufacturing",
];

const items = [...manufacturers, ...manufacturers];

export function ManufacturerMarquee() {
  return (
    <section className="py-20 px-4 md:px-8 overflow-hidden bg-white border-y border-[#E4E7EC]">
      <div className="max-w-[1280px] mx-auto text-center mb-10">
        <h2 className="font-headline-lg text-[#0B1F3A] mb-3" data-reveal>
          Sourcing from Global Leaders
        </h2>
        <p className="font-body-md text-[#44474d]" data-reveal data-delay="0.1">
          Direct partnerships with the world&apos;s top semiconductor manufacturers and authorized distributors.
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-28 z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, #ffffff, transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-28 z-10 pointer-events-none"
          style={{ background: "linear-gradient(-90deg, #ffffff, transparent)" }} />

        <div className="flex gap-5 animate-marquee">
          {items.map((mfr, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-3 bg-white border border-[#E4E7EC] rounded-xl px-6 py-3.5 shadow-sm hover:shadow-md hover:border-[#1769E0]/30 hover:-translate-y-0.5 transition-all duration-300 group shrink-0"
            >
              <div className="w-9 h-9 rounded-lg bg-[#e8eeff] flex items-center justify-center shrink-0 group-hover:bg-[#1769E0]/15 transition-colors duration-300">
                <span className="font-bold text-[#0B1F3A] text-sm">{mfr.substring(0, 2).toUpperCase()}</span>
              </div>
              <span className="font-label-md text-[#111c2d] text-sm whitespace-nowrap">{mfr}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
