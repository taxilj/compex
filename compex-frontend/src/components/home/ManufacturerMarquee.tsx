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
    <section className="py-14 px-4 md:px-8 overflow-hidden bg-white border-b border-[#E4E7EC]">
      <div className="max-w-[1280px] mx-auto mb-6">
        <h2 className="font-headline-md text-[#0B1F3A]">Sourcing from global leaders</h2>
        <p className="font-body-sm text-[#44474d] mt-1">Direct partnerships with the world&apos;s top semiconductor manufacturers and authorized distributors.</p>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, #ffffff, transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: "linear-gradient(-90deg, #ffffff, transparent)" }} />

        <div className="flex gap-3 animate-marquee">
          {items.map((mfr, i) => (
            <div key={i} className="inline-flex items-center border border-[#E4E7EC] px-5 py-3 shrink-0">
              <span className="font-mono-label text-[#0B1F3A] text-sm whitespace-nowrap">{mfr}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
