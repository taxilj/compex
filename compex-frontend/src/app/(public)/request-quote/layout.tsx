import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Request a Quote for Electronic Components",
  description:
    "Tell Compex which components you need, by part number or by uploading a BOM, and the sourcing team will respond with a quotation.",
  path: "/request-quote",
});

export default function RequestQuoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
