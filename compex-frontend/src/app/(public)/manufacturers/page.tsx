import type { Metadata } from "next";
import Link from "next/link";
import CTABanner from "@/components/ui/CTABanner";
import ManufacturersGrid from "./ManufacturersGrid";

export const metadata: Metadata = {
  title: "Electronic Component Manufacturers | Compex Solution",
  description: "Compex Solution sources from leading global semiconductor and electronic component manufacturers including ST, TI, NXP, Infineon, and more.",
};

const manufacturers = [
  { name: "STMicroelectronics", abbr: "ST", categories: ["Microcontrollers", "Motor Control", "Power ICs", "Sensors"] },
  { name: "Texas Instruments", abbr: "TI", categories: ["Processors", "Analog ICs", "Power Management", "Interface"] },
  { name: "NXP Semiconductors", abbr: "NX", categories: ["Microcontrollers", "RF", "Automotive", "Security"] },
  { name: "Infineon Technologies", abbr: "IF", categories: ["Power Semiconductors", "Automotive", "Security", "Sensors"] },
  { name: "Microchip Technology", abbr: "MC", categories: ["Microcontrollers", "Ethernet", "USB", "CAN"] },
  { name: "Renesas Electronics", abbr: "RE", categories: ["Microcontrollers", "Analog", "Power", "Connectivity"] },
  { name: "Nordic Semiconductor", abbr: "NO", categories: ["Bluetooth", "Wi-Fi", "LTE-M", "Thread"] },
  { name: "Qualcomm", abbr: "QC", categories: ["Wireless", "Processing", "Connectivity", "RF"] },
  { name: "Analog Devices", abbr: "AD", categories: ["Data Converters", "Amplifiers", "Sensors", "Power"] },
  { name: "onsemi", abbr: "ON", categories: ["Power Discretes", "Image Sensors", "Motor Control", "EV"] },
];

export default function ManufacturersPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Manufacturers</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Sourcing from Global Semiconductor Leaders
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            We source from the world&apos;s leading semiconductor and electronic component manufacturers. Contact us with your specific part numbers and quantities.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          <ManufacturersGrid fallback={manufacturers} />
        </div>
      </section>

      <section className="py-16 px-4 md:px-8 bg-[#f9f9ff]">
        <div className="max-w-[1280px] mx-auto text-center">
          <h2 className="font-headline-lg text-[#0B1F3A] mb-4">Don&apos;t see your manufacturer?</h2>
          <p className="font-body-lg text-[#44474d] mb-8 max-w-2xl mx-auto">
            We source from hundreds of manufacturers. Contact us with your part number and we will find the best available source.
          </p>
          <Link
            href="/request-quote"
            className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors"
          >
            Submit Your Requirement
          </Link>
        </div>
      </section>

      <CTABanner />
    </div>
  );
}