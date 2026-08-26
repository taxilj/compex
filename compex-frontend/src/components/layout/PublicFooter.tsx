import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="w-full bg-[#0B1F3A] text-[#7587a7] py-16 mt-16">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#1769E0] flex items-center justify-center">
                <span className="text-white font-bold text-xs">CX</span>
              </div>
              <h4 className="font-headline-sm text-white">Compex Solution</h4>
            </div>
            <p className="font-body-sm text-[#7587a7]">
              Leading B2B enterprise procurement and global supply chain management partner for industrial electronics.
            </p>
          </div>
          <div className="space-y-4">
            <h5 className="font-label-md text-white uppercase tracking-wider">Quick Links</h5>
            <nav className="flex flex-col gap-2">
              <Link href="/about" className="font-body-sm hover:text-[#afc6ff] transition-colors">About Us</Link>
              <Link href="/contact" className="font-body-sm hover:text-[#afc6ff] transition-colors">Contact Support</Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h5 className="font-label-md text-white uppercase tracking-wider">Solutions</h5>
            <nav className="flex flex-col gap-2">
              <Link href="/sourcing" className="font-body-sm hover:text-[#afc6ff] transition-colors">BOM Sourcing</Link>
              <Link href="/sourcing" className="font-body-sm hover:text-[#afc6ff] transition-colors">Global Sourcing</Link>
              <Link href="/services" className="font-body-sm hover:text-[#afc6ff] transition-colors">Logistics Management</Link>
            </nav>
          </div>
          <div className="space-y-4">
            <h5 className="font-label-md text-white uppercase tracking-wider">Compliance</h5>
            <nav className="flex flex-col gap-2">
              <Link href="/services" className="font-body-sm hover:text-[#afc6ff] transition-colors">Quality Assurance</Link>
            </nav>
          </div>
        </div>
        <div className="pt-8 border-t border-[#7587a7]/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-body-sm text-[#7587a7]/70">© 2024 Compex Solution. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
