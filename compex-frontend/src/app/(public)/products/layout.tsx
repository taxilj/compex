import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Search Electronic Components by MPN",
  description:
    "Search the Compex catalogue by exact manufacturer part number, description or manufacturer, then request a quote for the parts you need.",
  path: "/products",
});

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
