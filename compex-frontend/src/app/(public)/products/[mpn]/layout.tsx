import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

// The title comes from the URL's MPN, so it needs no API call and can never fail.
export async function generateMetadata({ params }: { params: Promise<{ mpn: string }> }): Promise<Metadata> {
  const { mpn: rawMpn } = await params;
  let mpn = rawMpn;
  try {
    mpn = decodeURIComponent(rawMpn);
  } catch {
    // malformed escape: keep the raw segment
  }
  return pageMetadata({
    title: `${mpn} — Electronic Component`,
    description: `Specifications, manufacturer and sourcing enquiry for ${mpn}. Request a quote for this part from Compex Solution.`,
    path: `/products/${encodeURIComponent(mpn)}`,
  });
}

export default function ProductDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
