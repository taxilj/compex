import Link from "next/link";

const columns = [
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/case-studies", label: "Case Studies" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Sourcing",
    links: [
      { href: "/sourcing", label: "How Sourcing Works" },
      { href: "/services", label: "Services" },
      { href: "/industries", label: "Industries We Serve" },
    ],
  },
  {
    heading: "Catalogue",
    links: [
      { href: "/products", label: "Search Components" },
      { href: "/manufacturers", label: "Manufacturers" },
      { href: "/resources", label: "Resources" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/request-quote", label: "Request a Quote" },
      { href: "/login", label: "Customer Login" },
      { href: "/register", label: "Create an Account" },
    ],
  },
];

export default function PublicFooter() {
  return (
    <footer className="w-full bg-[#0B1F3A] text-[#afc6ff] py-14 mt-16">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-x-8 gap-y-10 pb-10 border-b border-white/10">
          <div className="col-span-2 md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-[#1769E0] flex items-center justify-center">
                <span className="text-white font-bold text-xs">CX</span>
              </div>
              <h4 className="font-headline-sm text-white">Compex Solution</h4>
            </div>
            <p className="font-body-sm max-w-xs">
              Industrial electronic component sourcing. Search a part, submit your requirement, and Compex sources it for you.
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.heading} className="space-y-3">
              <h5 className="font-mono-label text-white/70 uppercase tracking-wider text-xs">{col.heading}</h5>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="font-body-sm hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="font-body-sm text-[#afc6ff]/70">© {new Date().getFullYear()} Compex Solution. All rights reserved.</p>
          <p className="font-mono-label text-[#afc6ff]/50 text-xs">Exact-MPN sourcing · Manufacturer-verified data</p>
        </div>
      </div>
    </footer>
  );
}
