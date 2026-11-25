import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, PRODUCT_SITEMAP_PATH, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}${PRODUCT_SITEMAP_PATH}`],
  };
}
