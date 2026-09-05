"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { FileText, ShoppingCart, Package } from "lucide-react";
import { lookupPublicProduct, type PublicProduct, type ProviderStatusEntry } from "@/lib/api/products";
import { ApiError } from "@/lib/api/client";

const PROVIDER_LABELS: Record<string, string> = {
  MOUSER: "Mouser",
  DIGIKEY: "DigiKey",
  ELEMENT14: "element14",
  NEXAR: "Nexar",
};

export default function ProductDetailPage({ params }: { params: Promise<{ mpn: string }> }) {
  const { mpn } = use(params);
  return <ProductDetailContent key={mpn} mpn={mpn} />;
}

function ProductDetailContent({ mpn }: { mpn: string }) {
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [sources, setSources] = useState<ProviderStatusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    lookupPublicProduct(mpn)
      .then((result) => {
        if (cancelled) return;
        setProduct(result.product);
        setSources(result.sources);
        if (!result.product) setNotFound(true);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError instanceof ApiError ? requestError.message : "We could not look up this product right now.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [mpn]);

  if (loading) {
    return <div className="max-w-[1280px] mx-auto px-6 py-12 font-body-md text-[#44474d]">Looking up product...</div>;
  }

  if (error) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-12 text-center">
        <h1 className="font-headline-lg text-[#111c2d] mb-3">Product lookup unavailable</h1>
        <p className="font-body-md text-[#44474d] mb-6">{error}</p>
        <Link href="/products" className="text-[#1769E0] hover:underline font-label-md">Back to catalogue</Link>
      </div>
    );
  }

  if (notFound || !product) return <NoResult mpn={mpn} sources={sources} />;

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-10">
      <nav className="flex items-center gap-2 font-label-sm text-[#44474d] text-xs">
        <Link href="/" className="hover:text-[#1769E0]">Home</Link><span>/</span>
        <Link href="/products" className="hover:text-[#1769E0]">Products</Link><span>/</span>
        <span className="text-[#111c2d]">{product.mpn}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <div className="bg-white rounded-xl p-8 border border-[#E4E7EC] shadow-sm flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-56 h-56 shrink-0 bg-[#f0f3ff] border border-[#E4E7EC] rounded-lg flex items-center justify-center overflow-hidden">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-contain" />
              ) : <Package size={64} className="text-[#0B1F3A]/20" />}
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {product.category && <span className="font-label-sm text-[#1769E0] tracking-widest uppercase">{product.category}</span>}
                  {product.category && <span className="w-1 h-1 rounded-full bg-[#E4E7EC]" />}
                  <span className="font-label-md text-[#44474d]">{product.manufacturer}</span>
                </div>
                <h1 className="font-headline-lg text-[#111c2d] mb-1">{product.productName}</h1>
                <p className="font-mono-label text-[#44474d] mb-3">{product.mpn}</p>
                <p className="font-body-md text-[#44474d] max-w-2xl">{product.description ?? "No description available."}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7EC] flex items-center justify-between">
              <h2 className="font-headline-sm text-[#111c2d]">Technical Specifications</h2>
              {product.datasheetUrl && (
                <a href={product.datasheetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#1769E0] hover:underline font-label-md text-sm">
                  <FileText size={16} /> Download Datasheet (PDF)
                </a>
              )}
            </div>
            {product.specifications.length > 0 ? (
              <table className="w-full text-left"><tbody>
                {product.specifications.map((specification) => (
                  <tr key={`${specification.name}-${specification.value}`} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#f0f3ff]/40 transition-colors">
                    <th className="py-3 px-5 font-label-md text-[#44474d] w-1/3 bg-[#f9f9ff] border-r border-[#E4E7EC]/50">{specification.name}</th>
                    <td className="py-3 px-5 font-body-sm text-[#111c2d]">{specification.value}</td>
                  </tr>
                ))}
              </tbody></table>
            ) : <p className="px-6 py-6 font-body-sm text-[#44474d]">No specifications available for this product.</p>}
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-4">
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6 space-y-5 sticky top-24">
            <h3 className="font-headline-sm text-[#111c2d]">Get Pricing</h3>
            <Link href={quoteHref(product.mpn, product.manufacturer)} className="flex items-center justify-center gap-2 w-full bg-[#1769E0] text-white font-label-md py-3 rounded-lg hover:bg-[#1769E0]/90 transition-colors">
              <ShoppingCart size={16} /> Request a Quote
            </Link>
            <p className="text-xs text-[#44474d] text-center">Pricing available on request. Contact us for volume discounts.</p>
          </div>
          <SourcesPanel sources={sources} />
        </div>
      </div>
    </div>
  );
}

// Provider/source presence only -- never commercial data (Phase 10). A
// provider that errored/timed out/was rate-limited is shown as a small
// non-blocking notice, never a scary full-page error, since other sources
// may still have found the part.
function SourcesPanel({ sources }: { sources: ProviderStatusEntry[] }) {
  if (sources.length === 0) return null;
  const found = sources.filter((s) => s.status === "FOUND");
  const unavailable = sources.filter((s) => s.status === "ERROR" || s.status === "TIMEOUT" || s.status === "RATE_LIMITED");

  return (
    <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6 space-y-3">
      <h3 className="font-headline-sm text-[#111c2d] text-sm">Sources found</h3>
      {found.length > 0 ? (
        <ul className="space-y-1.5">
          {found.map((s) => (
            <li key={s.provider} className="flex items-center gap-2 font-body-sm text-[#111c2d]">
              <span className="text-[#12805c]">✓</span> {PROVIDER_LABELS[s.provider] ?? s.provider}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body-sm text-[#44474d]">No sources reported this part directly.</p>
      )}
      {unavailable.length > 0 && (
        <p className="text-xs text-[#8a6d3b] bg-[#fdf6e3] rounded px-3 py-2">Some sources are temporarily unavailable.</p>
      )}
    </div>
  );
}

function NoResult({ mpn, sources }: { mpn: string; sources: ProviderStatusEntry[] }) {
  const unavailable = sources.some((s) => s.status === "ERROR" || s.status === "TIMEOUT" || s.status === "RATE_LIMITED");
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 text-center">
      <h1 className="font-headline-lg text-[#111c2d] mb-3">Product not found</h1>
      <p className="font-body-md text-[#44474d] mb-6">We couldn&apos;t find an exact product match for MPN &ldquo;{mpn}&rdquo;.</p>
      {unavailable && (
        <p className="text-xs text-[#8a6d3b] bg-[#fdf6e3] inline-block rounded px-3 py-2 mb-6">Some sources are temporarily unavailable. This is not confirmed as a non-existent part.</p>
      )}
      <div className="flex flex-wrap justify-center gap-4">
        <Link href={quoteHref(mpn)} className="bg-[#1769E0] text-white px-5 py-3 rounded-lg font-label-md hover:bg-[#1257b8]">Request a Quote</Link>
        <Link href="/products" className="text-[#1769E0] hover:underline font-label-md py-3">Back to catalogue</Link>
      </div>
    </div>
  );
}

function quoteHref(mpn: string, manufacturer?: string): string {
  const params = new URLSearchParams({ mpn });
  if (manufacturer) params.set("manufacturer", manufacturer);
  return `/request-quote?${params.toString()}`;
}
