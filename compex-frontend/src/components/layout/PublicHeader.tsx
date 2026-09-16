"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, ChevronDown, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { listCategories, type CategoryWithChildren } from "@/lib/api/products";
import { listManufacturers, type ManufacturerListItem } from "@/lib/api/manufacturers";
import { useClickOutside } from "@/hooks/useClickOutside";
import HeaderSearch from "@/components/layout/HeaderSearch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navLinks = [
  { href: "/suppliers", label: "Suppliers" },
  { href: "/sourcing", label: "How Sourcing Works" },
  { href: "/industries", label: "Industries" },
];

const resourceLinks = [
  { href: "/tools/bom", label: "BOM Sourcing" },
  { href: "/tools/rfq", label: "Request for Quote" },
  { href: "/tools/search-multiple", label: "Search Multiple MPNs" },
  { href: "/tools/calculators", label: "Engineering Calculators" },
  { href: "/resources", label: "Resource Center" },
];

type MenuKey = "categories" | "manufacturers" | "resources";

function DropdownLoading() {
  return (
    <p className="flex items-center gap-2 font-body-sm text-[#44474d] px-2 py-3">
      <Loader2 size={14} className="animate-spin" /> Loading…
    </p>
  );
}

function DropdownError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-2 py-3 space-y-2">
      <p className="flex items-center gap-2 font-body-sm text-[#F04438]" role="alert">
        <AlertCircle size={14} /> Couldn&apos;t load. Please try again.
      </p>
      <button type="button" onClick={onRetry} className="font-label-sm text-[#1769E0] hover:underline">
        Retry
      </button>
    </div>
  );
}

function DropdownEmpty({ text }: { text: string }) {
  return <p className="font-body-sm text-[#44474d] px-2 py-3">{text}</p>;
}

function CategoryTree({ categories, onSelect, depth = 0 }: { categories: CategoryWithChildren[]; onSelect: () => void; depth?: number }) {
  if (categories.length === 0) return null;
  return (
    <ul className={depth === 0 ? "space-y-1" : "mt-1 space-y-1 border-l border-[#E4E7EC] pl-3"}>
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={`/products?categoryId=${encodeURIComponent(category.id)}`}
            onClick={onSelect}
            className="block py-0.5 font-body-sm text-[#44474d] hover:text-[#1769E0]"
          >
            {category.name}
          </Link>
          <CategoryTree categories={category.children} onSelect={onSelect} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

function MobileCategoryTree({ categories, onSelect }: { categories: CategoryWithChildren[]; onSelect: () => void }) {
  return (
    <ul className="space-y-1">
      {categories.map((category) => (
        <li key={category.id}>
          {category.children.length === 0 ? (
            <Link href={`/products?categoryId=${encodeURIComponent(category.id)}`} className="block py-2 font-body-sm text-[#111c2d] hover:text-[#1769E0]" onClick={onSelect}>
              {category.name}
            </Link>
          ) : (
            <details className="group rounded border border-[#E4E7EC] px-3 py-2">
              <summary className="cursor-pointer list-none font-label-md text-[#111c2d] marker:content-none">
                <span className="flex items-center justify-between gap-3">{category.name}<ChevronDown size={16} className="transition-transform group-open:rotate-180" /></span>
              </summary>
              <div className="mt-2 border-t border-[#E4E7EC] pt-2">
                <Link href={`/products?categoryId=${encodeURIComponent(category.id)}`} className="font-label-sm text-[#1769E0] hover:underline" onClick={onSelect}>View all {category.name}</Link>
                <div className="mt-1"><MobileCategoryTree categories={category.children} onSelect={onSelect} /></div>
              </div>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

function ProductCategoryMenu({ categories, onSelect }: { categories: CategoryWithChildren[]; onSelect: () => void }) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const activeCategory = categories.find((category) => category.id === activeCategoryId);

  return (
    <div className="flex min-h-[18rem]">
      <div className="w-72 shrink-0 py-2">
        <div className="flex items-center justify-between border-b border-[#E4E7EC] px-4 pb-2">
          <span className="font-label-md uppercase tracking-wide text-[#111c2d]">Products</span>
          <Link href="/categories" onClick={onSelect} className="font-label-sm text-[#1769E0] hover:underline">View all</Link>
        </div>
        <ul className="py-1">
          {categories.map((category) => {
            const active = category.id === activeCategoryId;
            return (
              <li key={category.id}>
                <Link
                  href={`/products?categoryId=${encodeURIComponent(category.id)}`}
                  onClick={onSelect}
                  onMouseEnter={() => setActiveCategoryId(category.id)}
                  onFocus={() => setActiveCategoryId(category.id)}
                  className={`flex items-center justify-between gap-3 px-4 py-2 font-body-sm ${active ? "bg-[#F0F3FF] text-[#0B1F3A]" : "text-[#344054] hover:bg-[#F8FAFC]"}`}
                >
                  <span>{category.name}</span>
                  {category.children.length > 0 && <ChevronRight size={16} aria-hidden="true" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {activeCategory?.children.length ? (
        <div className="w-80 border-l border-[#E4E7EC] bg-[#FCFCFD] p-4">
          <Link href={`/products?categoryId=${encodeURIComponent(activeCategory.id)}`} onClick={onSelect} className="font-label-md text-[#111c2d] hover:text-[#1769E0]">
            {activeCategory.name}
          </Link>
          <p className="mt-1 font-body-sm text-[#667085]">Browse subcategories</p>
          <CategoryTree categories={activeCategory.children} onSelect={onSelect} />
        </div>
      ) : null}
    </div>
  );
}

function NavDropdown({
  label,
  isOpen,
  onToggle,
  onClose,
  panelClassName,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useClickOutside(ref, onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        // Return focus to the trigger rather than dropping it to <body> --
        // a keyboard user who tabbed into the panel shouldn't lose their
        // place when the panel unmounts.
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative hidden lg:block shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-1.5 font-label-md text-[#111c2d] hover:text-[#1769E0] py-2"
      >
        {label}
        <ChevronDown size={14} className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {isOpen && (
        <div className={`absolute left-0 top-full mt-1 bg-white border border-[#E4E7EC] rounded shadow-lg z-50 ${panelClassName ?? "w-[280px] p-2"}`}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);

  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);
  const [categoriesFetched, setCategoriesFetched] = useState(false);

  const [manufacturers, setManufacturers] = useState<ManufacturerListItem[]>([]);
  const [manufacturersLoading, setManufacturersLoading] = useState(false);
  const [manufacturersError, setManufacturersError] = useState(false);
  const [manufacturersFetched, setManufacturersFetched] = useState(false);

  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const toggleMenu = useCallback((menu: MenuKey) => {
    setOpenMenu((current) => {
      const next = current === menu ? null : menu;
      // Set the loading flag in the same click handler that opens the menu
      // (not the fetch effect) so the panel never renders an empty flash
      // before the effect's own setTimeout(0) fires.
      if (next === "manufacturers" && !manufacturersFetched && !manufacturersError) {
        setManufacturersLoading(true);
      }
      return next;
    });
  }, [manufacturersFetched, manufacturersError]);

  // Fetches once on mount; a failed/retried attempt re-runs this same effect
  // by flipping categoriesFetched/categoriesError back to false. All state
  // changes happen inside the setTimeout callback (never synchronously in
  // the effect body) to avoid a cascading-render lint violation -- mirrors
  // the debounced-fetch pattern already used on the manufacturer detail page.
  useEffect(() => {
    if (categoriesFetched || categoriesError) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setCategoriesLoading(true);
      listCategories()
        .then((data) => { if (!cancelled) setCategories(data); })
        .catch((err) => {
          if (cancelled) return;
          console.error("Failed to load categories:", err);
          setCategoriesError(true);
        })
        .finally(() => {
          if (cancelled) return;
          setCategoriesLoading(false);
          setCategoriesFetched(true);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoriesFetched, categoriesError]);

  const retryCategories = useCallback(() => {
    setCategoriesLoading(true);
    setCategoriesError(false);
    setCategoriesFetched(false);
  }, []);

  // Fetch manufacturers lazily on first open rather than on every page load
  // -- unlike categories (shown immediately in the panel), nothing needs
  // this data until a visitor actually opens the dropdown.
  useEffect(() => {
    if (openMenu !== "manufacturers" || manufacturersFetched || manufacturersError) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setManufacturersLoading(true);
      listManufacturers({ limit: 8 })
        .then((res) => { if (!cancelled) setManufacturers(res.data); })
        .catch((err) => {
          if (cancelled) return;
          console.error("Failed to load manufacturers:", err);
          setManufacturersError(true);
        })
        .finally(() => {
          if (cancelled) return;
          setManufacturersLoading(false);
          setManufacturersFetched(true);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [openMenu, manufacturersFetched, manufacturersError]);

  const retryManufacturers = useCallback(() => {
    setManufacturersLoading(true);
    setManufacturersError(false);
    setManufacturersFetched(false);
  }, []);

  return (
    <header className="fixed top-0 w-full z-50 bg-white border-b border-[#E4E7EC]">
      <div className="h-16 max-w-[1440px] mx-auto px-4 md:px-8 flex items-center gap-4 md:gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0" aria-label="Compex Solution home">
          <Image
            src="/compex-logo.jpeg"
            alt="Compex Solution"
            width={140}
            height={96}
            priority
            className="h-10 w-auto"
          />
        </Link>

        {/* Semikart-like full-width header search, backed by real COMPEX categories. */}
        <HeaderSearch categories={categories} className="hidden md:block flex-1 min-w-0 max-w-2xl" />

        {/* DigiKey-like Products menu: main categories first, children on hover/focus. */}
        <NavDropdown
          label="Products"
          isOpen={openMenu === "categories"}
          onToggle={() => toggleMenu("categories")}
          onClose={closeMenu}
          panelClassName="w-[min(672px,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto p-0"
        >
          {categoriesLoading && <DropdownLoading />}
          {!categoriesLoading && categoriesError && <DropdownError onRetry={retryCategories} />}
          {!categoriesLoading && !categoriesError && categories.length === 0 && (
            <DropdownEmpty text="No categories found." />
          )}
          {!categoriesLoading && !categoriesError && categories.length > 0 && <ProductCategoryMenu categories={categories} onSelect={closeMenu} />}
        </NavDropdown>

        {/* Manufacturers dropdown */}
        <NavDropdown
          label="Manufacturers"
          isOpen={openMenu === "manufacturers"}
          onToggle={() => toggleMenu("manufacturers")}
          onClose={closeMenu}
          panelClassName="w-[320px] max-h-[70vh] overflow-y-auto p-2"
        >
          {manufacturersLoading && <DropdownLoading />}
          {!manufacturersLoading && manufacturersError && <DropdownError onRetry={retryManufacturers} />}
          {!manufacturersLoading && !manufacturersError && manufacturersFetched && manufacturers.length === 0 && (
            <DropdownEmpty text="No manufacturers found." />
          )}
          {!manufacturersLoading && !manufacturersError && manufacturers.map((mfr) => (
            <Link
              key={mfr.id}
              href={`/manufacturers/${encodeURIComponent(mfr.slug)}`}
              onClick={closeMenu}
              className="flex items-center justify-between px-2 py-2 rounded hover:bg-[#f0f3ff]"
            >
              <span className="font-body-sm text-[#111c2d]">{mfr.name}</span>
              <span className="font-mono-label text-[#75777e] text-xs">{mfr._count.products}</span>
            </Link>
          ))}
          <div className="pt-2 mt-2 border-t border-[#E4E7EC]">
            <Link href="/manufacturers" onClick={closeMenu} className="font-label-sm text-[#1769E0] hover:underline px-2 block">
              View all manufacturers →
            </Link>
          </div>
        </NavDropdown>

        {/* Resources dropdown */}
        <NavDropdown
          label="Resources"
          isOpen={openMenu === "resources"}
          onToggle={() => toggleMenu("resources")}
          onClose={closeMenu}
          panelClassName="w-[260px] p-2"
        >
          {resourceLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="block px-2 py-2 rounded font-body-sm text-[#111c2d] hover:bg-[#f0f3ff] hover:text-[#1769E0]"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 mt-2 border-t border-[#E4E7EC]">
            <Link href="/tools" onClick={closeMenu} className="font-label-sm text-[#1769E0] hover:underline px-2 block">
              View all tools →
            </Link>
          </div>
        </NavDropdown>

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
          <button className="xl:hidden p-1 text-[#44474d]" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 flex flex-col gap-5">
            <HeaderSearch categories={categories} onNavigate={() => setMobileOpen(false)} />

            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-label-md text-[#44474d] hover:text-[#1769E0] py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="font-label-md text-[#44474d] hover:text-[#0B1F3A] py-2" onClick={() => setMobileOpen(false)}>
                Login
              </Link>
            </nav>

            <div className="pt-3 border-t border-[#E4E7EC]">
              <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-2">Product Categories</p>
              {categoriesLoading && <DropdownLoading />}
              {!categoriesLoading && categoriesError && <DropdownError onRetry={retryCategories} />}
              {!categoriesLoading && !categoriesError && categories.length === 0 && (
                <DropdownEmpty text="No categories found." />
              )}
              {!categoriesLoading && !categoriesError && categories.length > 0 && <MobileCategoryTree categories={categories} onSelect={() => setMobileOpen(false)} />}
              {!categoriesLoading && !categoriesError && categories.length > 0 && <Link href="/categories" className="mt-3 inline-block font-label-sm text-[#1769E0] hover:underline" onClick={() => setMobileOpen(false)}>View all categories →</Link>}
            </div>

            <div className="pt-3 border-t border-[#E4E7EC]">
              <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-2">Manufacturers</p>
              <Link href="/manufacturers" className="font-body-sm text-[#1769E0] hover:underline" onClick={() => setMobileOpen(false)}>
                Browse all manufacturers →
              </Link>
            </div>

            <div className="pt-3 border-t border-[#E4E7EC]">
              <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-2">Resources</p>
              <div className="flex flex-col gap-1">
                {resourceLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-body-sm text-[#111c2d] hover:text-[#1769E0] py-1.5"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
