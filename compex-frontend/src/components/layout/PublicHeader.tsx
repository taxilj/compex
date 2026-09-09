"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, Search, ChevronDown } from "lucide-react";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";

const navLinks = [
  { href: "/products", label: "Products" },
  { href: "/manufacturers", label: "Manufacturers" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/tools", label: "Tools" },
  { href: "/sourcing", label: "How Sourcing Works" },
  { href: "/industries", label: "Industries" },
];

export default function PublicHeader() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [mpn, setMpn] = useState("");
  const categoriesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (categoriesRef.current && !categoriesRef.current.contains(event.target as Node)) {
        setCategoriesOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = mpn.trim().toUpperCase();
    if (normalized) router.push(`/products/${encodeURIComponent(normalized)}`);
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-white border-b border-[#E4E7EC]">
      <div className="h-16 max-w-[1440px] mx-auto px-4 md:px-8 flex items-center gap-4 md:gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded bg-[#0B1F3A] flex items-center justify-center">
            <span className="text-white font-bold text-xs tracking-tight">CX</span>
          </div>
          <span className="font-headline-sm text-[#0B1F3A] hidden sm:block">Compex Solution</span>
        </Link>

        {/* Categories dropdown */}
        <div ref={categoriesRef} className="relative hidden lg:block shrink-0">
          <button
            type="button"
            onClick={() => setCategoriesOpen((v) => !v)}
            aria-expanded={categoriesOpen}
            className="flex items-center gap-1.5 font-label-md text-[#111c2d] hover:text-[#1769E0] py-2"
          >
            Categories
            <ChevronDown size={14} className={categoriesOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          {categoriesOpen && categories.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-[280px] max-h-[70vh] overflow-y-auto bg-white border border-[#E4E7EC] rounded shadow-lg py-2 z-50">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?categoryId=${encodeURIComponent(cat.id)}`}
                  onClick={() => setCategoriesOpen(false)}
                  className="block px-4 py-2 font-body-sm text-[#111c2d] hover:bg-[#f0f3ff] hover:text-[#1769E0]"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Persistent MPN search */}
        <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md items-center gap-2 border border-[#E4E7EC] rounded px-3 py-1.5 focus-within:border-[#1769E0] focus-within:ring-1 focus-within:ring-[#1769E0]">
          <Search size={16} className="text-[#75777e] shrink-0" />
          <input
            aria-label="Search by exact MPN or part number"
            className="w-full bg-transparent border-none outline-none font-mono-label text-[#111c2d] placeholder:text-[#75777e] placeholder:font-body-sm"
            placeholder="Search exact MPN…"
            value={mpn}
            onChange={(event) => setMpn(event.target.value)}
          />
        </form>

        {/* Secondary nav */}
        <nav className="hidden xl:flex items-center gap-5 shrink-0">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="font-label-md text-[#44474d] hover:text-[#1769E0] whitespace-nowrap">
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
          <Link href="/login" className="font-label-md text-[#44474d] hover:text-[#0B1F3A] hidden sm:block whitespace-nowrap">
            Login
          </Link>
          <Link
            href="/request-quote"
            className="bg-[#1769E0] text-white px-4 py-2 rounded font-label-md hover:bg-[#1257b8] transition-colors whitespace-nowrap"
          >
            Request a Quote
          </Link>
          <button className="xl:hidden p-1 text-[#44474d]" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-[#E4E7EC] bg-white">
          <div className="max-w-[1440px] mx-auto px-4 py-4 flex flex-col gap-4">
            <form onSubmit={submitSearch} className="flex items-center gap-2 border border-[#E4E7EC] rounded px-3 py-2">
              <Search size={16} className="text-[#75777e] shrink-0" />
              <input
                aria-label="Search by exact MPN or part number"
                className="w-full bg-transparent border-none outline-none font-mono-label text-[#111c2d] placeholder:text-[#75777e] placeholder:font-body-sm"
                placeholder="Search exact MPN…"
                value={mpn}
                onChange={(event) => setMpn(event.target.value)}
              />
            </form>
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="font-label-md text-[#44474d] hover:text-[#1769E0] py-2" onClick={() => setMobileOpen(false)}>
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="font-label-md text-[#44474d] hover:text-[#0B1F3A] py-2" onClick={() => setMobileOpen(false)}>
                Login
              </Link>
            </nav>
            {categories.length > 0 && (
              <div className="pt-3 border-t border-[#E4E7EC]">
                <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-2">Categories</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Link key={cat.id} href={`/products?categoryId=${encodeURIComponent(cat.id)}`} className="tag" onClick={() => setMobileOpen(false)}>
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
