import type { BackendProduct } from "@/lib/api/products";
import { SITE_URL } from "@/lib/site";

const PAGE_SIZE = 100;
const MAX_PRODUCT_SITEMAP_ENTRIES = 10_000;
const SEO_FETCH_TIMEOUT_MS = 5_000;

function apiBaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  return value || null;
}

function productUrl(mpn: string): string {
  return `${SITE_URL}/products/${encodeURIComponent(mpn)}`;
}

/**
 * Read-only server-side catalogue lookup for metadata. It never calls the
 * on-demand resolver, so a crawler cannot cause provider requests or writes.
 */
export async function fetchProductForSeo(mpn: string): Promise<BackendProduct | null> {
  const base = apiBaseUrl();
  if (!base) return null;

  try {
    const response = await fetch(`${base}/products/${encodeURIComponent(mpn)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(SEO_FETCH_TIMEOUT_MS),
      next: { revalidate: 600 },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { success?: boolean; data?: BackendProduct };
    return body.success === false ? null : body.data ?? null;
  } catch {
    // Metadata must remain available even when the catalogue backend is cold,
    // unavailable, or not configured in a local build.
    return null;
  }
}

/**
 * Return canonical product URLs for crawlers. A missing or unhealthy backend
 * produces an empty list rather than failing the frontend build or sitemap.
 */
export async function fetchProductSitemapUrls(): Promise<string[]> {
  const base = apiBaseUrl();
  if (!base) return [];

  const urls: string[] = [];
  let page = 1;
  let total = 0;

  try {
    do {
      const response = await fetch(`${base}/products?page=${page}&limit=${PAGE_SIZE}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(SEO_FETCH_TIMEOUT_MS),
        next: { revalidate: 300 },
      });
      if (!response.ok) return [];
      const body = (await response.json()) as {
        success?: boolean;
        data?: Array<Pick<BackendProduct, "mpn">>;
        meta?: { total?: number; page?: number; limit?: number };
      };
      if (body.success === false || !body.data) return [];

      for (const product of body.data) {
        if (urls.length >= MAX_PRODUCT_SITEMAP_ENTRIES) break;
        if (product.mpn) urls.push(productUrl(product.mpn));
      }

      total = body.meta?.total ?? urls.length;
      page += 1;
      if (body.data.length === 0) break;
    } while (urls.length < Math.min(total, MAX_PRODUCT_SITEMAP_ENTRIES));

    return [...new Set(urls)];
  } catch {
    return [];
  }
}

