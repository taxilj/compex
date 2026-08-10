"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";

const navLinks = [
  { href: "/products", label: "Products" },
  { href: "/manufacturers", label: "Manufacturers" },
  { href: "/industries", label: "Industries" },
  { href: "/services", label: "Services" },
  { href: "/sourcing", label: "Sourcing" },
  { href: "/resources", label: "Resources" },
];

export default function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 bg-[#ffffff]/95 backdrop-blur-md shadow-sm border-b border-[#E4E7EC]">
      <div className="h-20 max-w-[1280px] mx-auto px-8 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded bg-[#0B1F3A] flex items-center justify-center">
            <span className="text-white font-bold text-sm tracking-tight">CX</span>
          </div>
          <span className="font-headline-sm text-[#0B1F3A] uppercase tracking-tight hidden sm:block">
            Compex Solution
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden xl:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-label-md text-[#44474d] hover:text-[#1769E0] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            aria-label="Search"
            className="text-[#44474d] hover:text-[#0B1F3A] flex items-center p-1"
          >
            <Search size={20} />
          </button>
          <Link
            href="/login"
            className="font-label-md text-[#44474d] hover:text-[#0B1F3A] hidden sm:block"
          >
            Login
          </Link>
          <Link
            href="/request-quote"
            className="bg-[#1769E0] text-white px-6 py-2.5 rounded font-label-md hover:bg-[#1257b8] transition-colors whitespace-nowrap"
          >
            Request a Quote
          </Link>
          {/* Mobile toggle */}
          <button
            className="xl:hidden p-1 text-[#44474d]"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-[#E4E7EC] bg-white">
          <nav className="max-w-[1280px] mx-auto px-8 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-label-md text-[#44474d] hover:text-[#1769E0] py-2 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="font-label-md text-[#44474d] hover:text-[#0B1F3A] py-2"
              onClick={() => setMobileOpen(false)}
            >
              Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
