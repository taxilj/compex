import type { Metadata } from "next";

export const SITE_NAME = "Compex Solution";

// Canonical host for absolute metadata URLs. Set NEXT_PUBLIC_SITE_URL to the production
// domain (e.g. the custom domain) so canonical and Open Graph URLs point at it; the fallback
// is the current live deployment.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://compex-frontend.vercel.app").replace(/\/$/, "");

const SHARE_IMAGE = "/compex-logo.jpeg";

interface PageMetadataInput {
  title: string;
  description: string;
  /** Route path, e.g. "/products". Resolved against metadataBase for the canonical URL. */
  path: string;
  /** Keep account/utility pages out of search results. */
  noindex?: boolean;
}

// One place that builds every public route's metadata, so titles, descriptions, canonicals
// and share cards stay consistent.
export function pageMetadata({ title, description, path, noindex = false }: PageMetadataInput): Metadata {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  return {
    title: fullTitle,
    description,
    alternates: { canonical: path },
    openGraph: { title: fullTitle, description, url: path, siteName: SITE_NAME, type: "website", images: [SHARE_IMAGE] },
    twitter: { card: "summary", title: fullTitle, description, images: [SHARE_IMAGE] },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
