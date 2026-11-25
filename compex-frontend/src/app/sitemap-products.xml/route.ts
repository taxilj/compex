import { fetchProductSitemapUrls } from "@/lib/seo-products";

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const urls = await fetchProductSitemapUrls();
  const entries = urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries ? `\n${entries}\n` : ""}</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

