import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, FileText, Mail } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import PublicFooter from "@/components/layout/PublicFooter";
import { pageMetadata } from "@/lib/site";

// A 404 must not claim the homepage as its canonical URL, so the canonical link is dropped.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Page Not Found",
    description: "The page you are looking for does not exist. Search the Compex catalogue or request a quote.",
    path: "/",
    noindex: true,
  }),
  alternates: undefined,
};

const shortcuts = [
  { href: "/products", label: "Search components", Icon: Search },
  { href: "/request-quote", label: "Request a quote", Icon: FileText },
  { href: "/contact", label: "Contact us", Icon: Mail },
];

// The root layout carries no site chrome (it lives in the (public) group), so the 404 renders its
// own header and footer: the logo, search and every main link stay available from a dead end.
export default function NotFound() {
  return (
    <>
      <PublicHeader />
      <main className="w-full pt-16 sm:pt-[6.25rem] lg:pt-[9.25rem]">
        <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
          <p className="font-mono-label text-[#1769E0] text-sm tracking-widest mb-4">ERROR 404</p>
          <h1 className="font-display-lg text-[#0B1F3A] mb-4">We can&apos;t find that page</h1>
          <p className="font-body-md text-[#44474d] max-w-xl mx-auto mb-8">
            The link may be outdated or mistyped. Search the catalogue by exact part number, or use one of the shortcuts below.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded-lg font-label-md hover:bg-[#1257b8] transition-colors"
          >
            Back to Home <ArrowRight size={16} />
          </Link>
          <ul className="mt-10 grid gap-3 sm:grid-cols-3 text-left">
            {shortcuts.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-lg border border-[#E4E7EC] bg-white px-4 py-3 font-label-md text-[#0B1F3A] hover:border-[#1769E0] hover:text-[#1769E0] transition-colors"
                >
                  <Icon size={18} className="shrink-0 text-[#1769E0]" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
