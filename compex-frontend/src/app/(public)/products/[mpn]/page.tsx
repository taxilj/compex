"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, ShoppingCart, Package } from "lucide-react";
import { getProduct, resolveProduct, type BackendProduct, type OnDemandProviderEntry } from "@/lib/api/products";
import { ApiError } from "@/lib/api/client";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";

// Defense-in-depth only -- the backend (public-dto.ts's
// filterPublicSpecifications) is the authoritative filter and never sends
// these keys. This just stops an internal-looking key from rendering here if
// that ever regresses.
const INTERNAL_SPEC_NAME_PATTERN =
  /internal|private|admin|provider|supplier|vendor|canonical|traceability|sourcing|margin|moq|sku|stock|cost|price|lead\s*time/i;

function isPublicSafeSpecName(name: string): boolean {
  return !INTERNAL_SPEC_NAME_PATTERN.test(name);
}

function specEntries(specifications: BackendProduct["specifications"]): Array<{ name: string; value: string }> {
  return Object.entries(specifications ?? {})
    .filter(([name]) => isPublicSafeSpecName(name))
    .map(([name, value]) => ({ name, value: String(value) }));
}

type LoadPhase = "checking-catalog" | "checking-sources" | "done";

export default function ProductDetailPage({ params }: { params: Promise<{ mpn: string }> }) {
  const { mpn: rawMpn } = use(params);
  // Next.js does not auto-decode a %2F inside a single dynamic-route segment
  // (it would be ambiguous with an actual path separator), so a real MPN
  // containing "/" (e.g. Microchip's PIC16F877A-I/P) arrives here still
  // percent-encoded and would otherwise get double-encoded on the API call
  // below, turning a valid MPN into an invalid-characters error.
  const mpn = decodeURIComponent(rawMpn);
  const searchParams = useSearchParams();
  const manufacturerId = searchParams.get("manufacturerId") ?? undefined;
  return <ProductDetailContent key={`${mpn}::${manufacturerId ?? ""}`} mpn={mpn} manufacturerId={manufacturerId} />;
}

function ProductDetailContent({ mpn, manufacturerId }: { mpn: string; manufacturerId?: string }) {
  const [product, setProduct] = useState<BackendProduct | null>(null);
  const [sources, setSources] = useState<OnDemandProviderEntry[]>([]);
  const [phase, setPhase] = useState<LoadPhase>("checking-catalog");
  const [notFound, setNotFound] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Database-first: a product already in the local catalog renders from
    // one fast Prisma query, with no wait on any external provider.
    getProduct(mpn, manufacturerId)
      .then((result) => {
        if (cancelled) return;
        setProduct(result);
        setPhase("done");
      })
      .catch(async (requestError: unknown) => {
        if (cancelled) return;

        if (requestError instanceof ApiError && requestError.statusCode === 409) {
          // Multiple manufacturers share this MPN and the URL carried no
          // manufacturerId to disambiguate -- a real, honest state, not a
          // "not found".
          setAmbiguous(true);
          setPhase("done");
          return;
        }

        if (!(requestError instanceof ApiError) || requestError.statusCode !== 404) {
          setError(requestError instanceof ApiError ? requestError.message : "We could not look up this product right now.");
          setPhase("done");
          return;
        }

        // Genuine catalog miss -- controlled, bounded, on-demand lookup
        // across the configured providers. This is the only path that ever
        // waits on an external call, and only for an MPN this database does
        // not yet have.
        setPhase("checking-sources");
        try {
          const resolved = await resolveProduct(mpn, manufacturerId);
          if (cancelled) return;
          setProduct(resolved.product);
          setSources(resolved.sources);
          if (!resolved.product) setNotFound(true);
        } catch (resolveError) {
          if (cancelled) return;
          setError(resolveError instanceof ApiError ? resolveError.message : "We could not look up this product right now.");
        } finally {
          if (!cancelled) setPhase("done");
        }
      });

    return () => { cancelled = true; };
  }, [mpn, manufacturerId]);

  if (phase !== "done") {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-10">
        <BreadcrumbShell current={mpn} />
        <div className="flex flex-col lg:flex-row gap-8" aria-busy="true" aria-label="Looking up product">
          <div className="flex-1 space-y-8">
            <div className="bg-white rounded-xl p-8 border border-[#E4E7EC] shadow-sm flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-56 h-56 shrink-0 bg-[#f0f3ff] rounded-lg animate-pulse" />
              <div className="flex-1 min-w-0 space-y-3 py-1">
                <div className="h-3 w-24 bg-[#f0f3ff] rounded animate-pulse" />
                <div className="h-9 w-64 bg-[#f0f3ff] rounded animate-pulse" />
                <div className="h-4 w-40 bg-[#f0f3ff] rounded animate-pulse" />
                <div className="h-4 w-full max-w-md bg-[#f0f3ff] rounded animate-pulse" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 w-full bg-[#f0f3ff] rounded animate-pulse" />
              ))}
            </div>
          </div>
          <div className="w-full lg:w-80">
            <div className="h-40 bg-[#f0f3ff] rounded-xl animate-pulse" />
          </div>
        </div>
        {phase === "checking-sources" && (
          <p className="text-center font-body-sm text-[#44474d]">Not yet in our catalogue — checking supplier sources…</p>
        )}
      </div>
    );
  }

  if (ambiguous) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-10">
        <BreadcrumbShell current={mpn} />
        <div className="text-center py-6 border border-dashed border-[#E4E7EC] rounded-xl">
          <h1 className="font-headline-lg text-[#111c2d] mb-3">Multiple manufacturers found</h1>
          <p className="font-body-md text-[#44474d] mb-6">More than one manufacturer offers a part numbered &ldquo;{mpn}&rdquo;. Select one from the catalogue to view its details.</p>
          <Link href={`/products?q=${encodeURIComponent(mpn)}`} className="bg-[#1769E0] text-white px-5 py-3 rounded-lg font-label-md hover:bg-[#1257b8]">View matches in catalogue</Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-10">
        <BreadcrumbShell current={mpn} />
        <div className="border border-[#F04438]/30 bg-[#F04438]/5 rounded-xl px-6 py-10 text-center" role="alert">
          <h1 className="font-headline-lg text-[#111c2d] mb-3">Product lookup unavailable</h1>
          <p className="font-body-md text-[#B42318] mb-6">{error}</p>
          <Link href="/products" className="text-[#1769E0] hover:underline font-label-md">Back to catalogue</Link>
        </div>
      </div>
    );
  }

  if (notFound || !product) return <NoResult mpn={mpn} sources={sources} />;

  const specifications = specEntries(product.specifications);
  const imageUrl = product.images[0];

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-10">
      <BreadcrumbShell current={product.mpn} />

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          {/* Title, MPN, manufacturer, package */}
          <div className="bg-white rounded-xl p-8 border border-[#E4E7EC] shadow-sm flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-56 h-56 shrink-0 bg-[#f0f3ff] border border-[#E4E7EC] rounded-lg flex items-center justify-center overflow-hidden">
              <ImageWithFallback
                src={imageUrl}
                alt={product.name ?? product.mpn}
                className="w-full h-full object-contain"
                fallback={<Package size={64} className="text-[#0B1F3A]/20" />}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                {product.category?.name && (
                  <span className="block font-label-sm text-[#1769E0] tracking-widest uppercase mb-1.5">{product.category.name}</span>
                )}
                <h1 className="font-mono text-[28px] sm:text-[32px] md:text-[40px] font-bold tracking-tight leading-[1.15] text-[#0B1F3A] mb-1.5 break-words">{product.mpn}</h1>
                {product.name && product.name !== product.description && (
                  <p className="font-body-sm font-medium text-[#44474d] mb-3 break-words">{product.name}</p>
                )}
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 max-w-sm">
                  <div>
                    <dt className="font-label-sm text-[#75777e] uppercase tracking-wider text-xs">Manufacturer</dt>
                    <dd className="font-body-sm text-[#111c2d] font-medium break-words">{product.manufacturer?.name ?? "Not available"}</dd>
                  </div>
                  <div>
                    <dt className="font-label-sm text-[#75777e] uppercase tracking-wider text-xs">Package</dt>
                    <dd className="font-body-sm text-[#111c2d] font-medium break-words">{product.packageType ?? "Not available"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Technical specifications */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7EC]">
              <h2 className="font-headline-sm text-[#111c2d]">Technical Specifications</h2>
            </div>
            {specifications.length > 0 ? (
              <table className="w-full text-left"><tbody>
                {specifications.map((specification) => (
                  <tr key={`${specification.name}-${specification.value}`} className="border-b border-[#E4E7EC] last:border-0 hover:bg-[#f0f3ff]/40 transition-colors">
                    <th className="py-3 px-5 font-label-md text-[#44474d] w-1/3 bg-[#f9f9ff] border-r border-[#E4E7EC]/50">{specification.name}</th>
                    <td className="py-3 px-5 font-body-sm text-[#111c2d]">{specification.value}</td>
                  </tr>
                ))}
              </tbody></table>
            ) : <p className="px-6 py-6 font-body-sm text-[#44474d]">No specifications available for this product.</p>}
          </div>

          {/* Datasheet / documents */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm px-6 py-4 flex items-center justify-between">
            <h2 className="font-headline-sm text-[#111c2d]">Documents</h2>
            {product.datasheetUrl ? (
              <a href={product.datasheetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#1769E0] hover:underline font-label-md text-sm">
                <FileText size={16} /> Download Datasheet (PDF)
              </a>
            ) : (
              <span className="flex items-center gap-2 text-[#44474d] font-label-md text-sm">
                <FileText size={16} /> Datasheet unavailable
              </span>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6">
            <h2 className="font-headline-sm text-[#111c2d] mb-3">Description</h2>
            <p className="font-body-sm text-[#44474d] max-w-2xl break-words">{product.description ?? "No description available."}</p>
          </div>
        </div>

        <div className="w-full lg:w-80 space-y-4">
          <div className="bg-white rounded-xl border border-[#E4E7EC] shadow-sm p-6 space-y-5 sticky top-24">
            <h3 className="font-headline-sm text-[#111c2d]">Source This Component</h3>
            <Link href={quoteHref(product.mpn, product.manufacturer?.name)} className="flex items-center justify-center gap-2 w-full bg-[#1769E0] text-white font-label-md py-3 rounded-lg hover:bg-[#1769E0]/90 transition-colors">
              <ShoppingCart size={16} /> Request a Quote
            </Link>
            <p className="text-xs text-[#44474d] text-center">Compex will source this component and respond with availability and next steps.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoResult({ mpn, sources }: { mpn: string; sources: OnDemandProviderEntry[] }) {
  const unavailable = sources.some((s) => s.status === "ERROR" || s.status === "TIMEOUT" || s.status === "RATE_LIMITED");
  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-10">
      <BreadcrumbShell current={mpn} />
      <div className="text-center py-6 border border-dashed border-[#E4E7EC] rounded-xl">
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
    </div>
  );
}

function BreadcrumbShell({ current }: { current: string }) {
  return (
    <nav className="flex items-center gap-2 font-label-sm text-[#44474d] text-xs" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-[#1769E0]">Home</Link><span>/</span>
      <Link href="/products" className="hover:text-[#1769E0]">Products</Link><span>/</span>
      <span className="text-[#111c2d] font-mono">{current}</span>
    </nav>
  );
}

function quoteHref(mpn: string, manufacturer?: string): string {
  const params = new URLSearchParams({ mpn });
  if (manufacturer) params.set("manufacturer", manufacturer);
  return `/request-quote?${params.toString()}`;
}
