import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const LOOKUP_TIMEOUT_MS = 3000;

// The manufacturer's real name makes the title meaningful. The lookup is bounded and falls
// back to a generic title, so a slow or unavailable API can never break or delay the page.
async function manufacturerName(slug: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/manufacturers/${encodeURIComponent(slug)}?limit=1`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { manufacturer?: { name?: unknown } } };
    const name = body.data?.manufacturer?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = await manufacturerName(slug);
  return pageMetadata({
    title: name ? `${name} Components` : "Manufacturer",
    description: name
      ? `Browse ${name} parts in the Compex Solution catalogue and request a quote for the components you need.`
      : "Browse this manufacturer's parts in the Compex Solution catalogue and request a quote.",
    path: `/manufacturers/${encodeURIComponent(slug)}`,
  });
}

export default function ManufacturerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
