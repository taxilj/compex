"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Package,
  Truck,
  Receipt,
  Building2,
  Bookmark,
} from "lucide-react";

const navItems = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/portal/rfqs", label: "My RFQs", icon: FileText, badge: "3" },
  { href: "/portal/quotes", label: "Quotes", icon: ClipboardList, badge: "1", badgeVariant: "success" as const },
  { href: "/portal/orders", label: "Orders", icon: Package },
  { href: "/portal/shipments", label: "Shipments", icon: Truck },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/saved", label: "Saved Products", icon: Bookmark },
];

const mgmtItems = [
  { href: "/portal/company", label: "Company Profile", icon: Building2 },
];

interface PortalSidebarProps {
  className?: string;
}

export function PortalSidebar({ className }: PortalSidebarProps) {
  const pathname = usePathname();
  const { companyName } = useAuth();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className={cn("w-64 shrink-0 bg-white border-r border-[#E4E7EC] flex flex-col h-full", className)}>
      <div className="px-6 py-8 flex-grow space-y-8 overflow-y-auto">
        <div className="space-y-1">
          <p className="font-label-sm text-[#44474d] uppercase tracking-wider px-3 mb-4">Procurement</p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded font-label-md transition-colors",
                isActive(item.href, item.exact)
                  ? "bg-[#e8eeff] text-[#0B1F3A]"
                  : "text-[#44474d] hover:bg-[#f0f3ff] hover:text-[#111c2d]"
              )}
            >
              <item.icon size={20} className={isActive(item.href, item.exact) ? "text-[#0B1F3A]" : ""} />
              <span>{item.label}</span>
              {item.badge && (
                <span className={cn(
                  "ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold",
                  item.badgeVariant === "success"
                    ? "bg-[#12B76A]/10 text-[#12B76A]"
                    : "bg-[#d6e3ff] text-[#0B1F3A]"
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="space-y-1 pt-4 border-t border-[#E4E7EC]">
          <p className="font-label-sm text-[#44474d] uppercase tracking-wider px-3 mb-4">Account</p>
          {mgmtItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded font-label-md transition-colors",
                isActive(item.href)
                  ? "bg-[#e8eeff] text-[#0B1F3A]"
                  : "text-[#44474d] hover:bg-[#f0f3ff] hover:text-[#111c2d]"
              )}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-[#E4E7EC]">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[#d9e3fb] flex items-center justify-center text-[#0B1F3A] font-bold text-sm">
            {companyName ? companyName.slice(0, 2).toUpperCase() : "—"}
          </div>
          <div className="min-w-0">
            <p className="font-label-md text-[#111c2d] truncate">{companyName ?? "Your Company"}</p>
            <p className="font-body-sm text-[#44474d] text-xs truncate">Enterprise Tier</p>
          </div>
        </div>
      </div>
    </aside>
  );
}