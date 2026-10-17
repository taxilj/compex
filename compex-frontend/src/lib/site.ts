import type { Metadata } from "next";

export const SITE_NAME = "Compex Solution";

// Canonical host for absolute metadata URLs. Set NEXT_PUBLIC_SITE_URL to the production
// domain (e.g. the custom domain) so canonical and Open Graph URLs point at it; the fallback
// is the current live deployment.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://compex-frontend.vercel.app").replace(/\/$/, "");

// Indexable public routes (the sitemap). Dynamic product and manufacturer pages are not listed:
// they need the catalogue API at build time and are discovered through the catalogue index pages.
export const PUBLIC_PATHS = [
  "/", "/products", "/categories", "/manufacturers", "/request-quote", "/contact", "/tools", "/tools/bom",
  "/tools/rfq", "/tools/calculators", "/resources", "/suppliers", "/industries", "/sourcing", "/services",
  "/about", "/case-studies",
];

// Routes crawlers must stay out of (robots.txt). The same routes are also noindex, through page
// metadata or an X-Robots-Tag header, so a direct link cannot get them indexed either.
export const PRIVATE_PATHS = [
  "/admin", "/portal", "/login", "/register", "/verify-email", "/setup-account", "/tools/search-multiple", "/api/",
];

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
