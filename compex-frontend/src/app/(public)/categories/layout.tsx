import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Electronic Component Categories",
  description:
    "Browse the Compex component catalogue by category, or search an exact manufacturer part number directly.",
  path: "/categories",
});

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
