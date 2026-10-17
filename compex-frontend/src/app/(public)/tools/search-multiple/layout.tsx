import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Search Multiple Part Numbers",
  description:
    "Check several manufacturer part numbers against the Compex catalogue in one go, then send the ones you need to a quote request.",
  path: "/tools/search-multiple",
  noindex: true, // a results utility with no content of its own
});

export default function SearchMultipleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
