import ProductDetailClient from "./ProductDetailClient";
import { fetchProductForSeo } from "@/lib/seo-products";

type ProductPageProps = {
  params: Promise<{ mpn: string }>;
  searchParams?: Promise<{ manufacturerId?: string | string[] }>;
};

function decodeMpn(rawMpn: string): string {
  try {
    return decodeURIComponent(rawMpn);
  } catch {
    return rawMpn;
  }
}

/**
 * Server wrapper for product pages. Known catalogue records render into the
 * initial HTML for crawlers and social previews; unknown MPNs still fall back
 * to the existing controlled client-side provider lookup.
 */
export default async function ProductDetailPage({ params, searchParams }: ProductPageProps) {
  const { mpn: rawMpn } = await params;
  const mpn = decodeMpn(rawMpn);
  const query = searchParams ? await searchParams : undefined;
  const manufacturerId = typeof query?.manufacturerId === "string" ? query.manufacturerId : undefined;
  const initialProduct = await fetchProductForSeo(mpn);

  return <ProductDetailClient mpn={mpn} manufacturerId={manufacturerId} initialProduct={initialProduct} />;
}
