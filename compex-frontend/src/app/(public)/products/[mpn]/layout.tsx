import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { fetchProductForSeo } from "@/lib/seo-products";

// The URL always supplies the exact MPN. A read-only catalogue lookup enriches
// the description when available, but never blocks metadata generation.
export async function generateMetadata({ params }: { params: Promise<{ mpn: string }> }): Promise<Metadata> {
  const { mpn: rawMpn } = await params;
  let mpn = rawMpn;
  try {
    mpn = decodeURIComponent(rawMpn);
  } catch {
    // malformed escape: keep the raw segment
  }
  const product = await fetchProductForSeo(mpn);
  const manufacturer = product?.manufacturer?.name;
  const factualDescription = product
    ? `${mpn}${manufacturer ? ` by ${manufacturer}` : ""}${product.name ? ` — ${product.name}` : ""}. View public specifications and request sourcing support from Compex Solution.`
    : `Specifications, manufacturer and sourcing enquiry for ${mpn}. Request a quote for this part from Compex Solution.`;

  return pageMetadata({
    title: `${mpn} — Electronic Component`,
    description: factualDescription,
    path: `/products/${encodeURIComponent(mpn)}`,
  });
}

export default function ProductDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
