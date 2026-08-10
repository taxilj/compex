import { notFound } from "next/navigation";
import Link from "next/link";
import { products, manufacturers } from "@/data/mock/products";
import { CheckCircle, FileText, ShoppingCart, Package } from "lucide-react";

export async function generateStaticParams() {
  return products.map((p) => ({ mpn: p.mpn }));
}

const availabilityLabel: Record<string, string> = {
  available: "In Stock",
  limited: "Limited Stock",
  on_request: "On Request",
};

const availabilityColor: Record<string, string> = {
  available: "text-[#12B76A]",
  limited: "text-[#F79009]",
  on_request: "text-[#44474d]",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ mpn: string }>;
}) {
  const { mpn } = await params;
  const product = products.find((p) => p.mpn === mpn);
  if (!product) notFound();
  const mfr = manufacturers.find((m) => m.id === product.manufacturerId);
  const tempRange = product.specs["Temperature Range"] ?? "−40°C ~ 85°C";

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-label-sm text-[#44474d] text-xs">
        <Link href="/" className="hover:text-[#1769E0]">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-[#1769E0]">Products</Link>
        <span>/</span>
        <span className="text-[#111c2d]">{product.mpn}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left */}
        <div className="flex-1 space-y-8">
          {/* Hero card */}
          <div className="bg-white rounded-xl p-8 border border-[#E4E7EC] shadow-sm flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-56 h-56 shrink-0 bg-[#f0f3ff] border border-[#E4E7EC] rounded-lg flex items-center justify-center">
              <Package size={64} className="text-[#0B1F3A]/20" />
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-label-sm text-[#1769E0] tracking-widest uppercase">{product.category}</span>
                  <span className="w-1 h-1 rounded-full bg-[#E4E7EC]" />
                  <span className="font-label-md text-[#44474d]">{mfr?.name}</span>
                </div>
                <h1 className="font-headline-lg text-[#111c2d] mb-3">{product.mpn}</h1>
                <p className="font-body-md text-[#44474d] max-w-2xl">{product.description}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {[
                  ["Package", product.package],
                  ["Mounting", "Surface Mount"],
                  ["Temp Range", tempRange],
                  ["RoHS", product.rohs ? "Compliant ✓" : "Non-compliant"],
                ].map(([label, val]) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="font-mono-label text-[#44474d] text-[11px] uppercase">{label}</span>
                    <span className={`font-label-md ${label === "RoHS" && product.rohs ? "text-[#12B76A]" : "text-[#111c2d]"}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Specs table */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7EC] flex items-center justify-between">
              <h2 className="font-headline-sm text-[#111c2d]">Technical Specifications</h2>
              {product.datasheet && (
                <a href={product.datasheet} className="flex items-center gap-2 text-[#1769E0] hover:underline font-label-md text-sm">
                  <FileText size={16} />
                  Download Datasheet (PDF)
                </a>
              )}
            </div>
            <table className="w-full text-left">
              <tbody>
                {Object.entries(product.specs).map(([key, val]) => (
                  <tr key={key} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#f0f3ff]/40 transition-colors">
                    <th className="py-3 px-5 font-label-md text-[#44474d] w-1/3 bg-[#f9f9ff] border-r border-[#E4E7EC]/50">{key}</th>
                    <td className="py-3 px-5 font-body-sm text-[#111c2d]">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compliance */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-4">Compliance &amp; Certifications</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "RoHS", ok: product.rohs },
                { label: "REACH", ok: product.reach },
                { label: "WEEE", ok: true },
                { label: "CE Mark", ok: true },
              ].map(({ label, ok }) => (
                <div key={label} className={`flex items-center gap-2 p-3 rounded-lg border ${ok ? "bg-[#12B76A]/5 border-[#12B76A]/20" : "bg-[#F04438]/5 border-[#F04438]/20"}`}>
                  <CheckCircle size={16} className={ok ? "text-[#12B76A]" : "text-[#F04438]"} />
                  <span className="font-label-md text-[#111c2d] text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: availability + CTA */}
        <div className="w-full lg:w-80">
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6 space-y-5 sticky top-24">
            <h3 className="font-headline-sm text-[#111c2d]">Availability</h3>
            <div className="space-y-3">
              {[
                { label: "Lead Time", val: `${product.leadTimeDays} business days`, cls: "text-[#111c2d]" },
                { label: "MOQ", val: `${product.moq} units`, cls: "text-[#111c2d]" },
                { label: "Status", val: availabilityLabel[product.availability] ?? product.availability, cls: availabilityColor[product.availability] ?? "text-[#111c2d]" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="font-label-md text-[#44474d]">{label}</span>
                  <span className={`font-label-md ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-[#E4E7EC] space-y-3">
              <Link
                href={`/request-quote?mpn=${product.mpn}`}
                className="flex items-center justify-center gap-2 w-full bg-[#1769E0] text-white font-label-md py-3 rounded-lg hover:bg-[#1769E0]/90 transition-colors"
              >
                <ShoppingCart size={16} />
                Request a Quote
              </Link>
              <Link
                href="/request-quote"
                className="flex items-center justify-center gap-2 w-full border border-[#E4E7EC] text-[#111c2d] font-label-md py-3 rounded-lg hover:bg-[#f0f3ff] transition-colors"
              >
                Add to RFQ List
              </Link>
            </div>
            <p className="text-xs text-[#44474d] text-center">Pricing available on request. Contact us for volume discounts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}