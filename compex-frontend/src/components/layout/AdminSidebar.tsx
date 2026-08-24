"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Package,
  Truck,
  Receipt,
  Users,
  ShoppingCart,
  BarChart3,
  Settings,
  Building2,
  Building,
  Layers,
} from "lucide-react";

const navGroups = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/rfqs", label: "RFQ Management", icon: FileText, disabled: false, badge: "8" },
      { href: "/admin/quotes", label: "Quotes", icon: ClipboardList, disabled: false },
      { href: "/admin/orders", label: "Sales Orders", icon: ShoppingCart, disabled: false },
      { href: "/admin/purchase-orders", label: "Purchase Orders", icon: Package, disabled: false },
      { href: "/admin/shipments", label: "Import & Shipments", icon: Truck, disabled: false },
      { href: "/admin/invoices", label: "Invoices", icon: Receipt, disabled: false },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Building2, disabled: false },
      { href: "/admin/vendors", label: "Vendors", icon: Users, disabled: false },
      { href: "/admin/products", label: "Product Catalog", icon: Layers, disabled: false },
      { href: "/admin/reports", label: "Reports & Analytics", icon: BarChart3, disabled: false },
      { href: "/admin/organization", label: "Organization", icon: Building, disabled: false },
      { href: "/admin/settings", label: "Settings", icon: Settings, disabled: false },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="w-64 shrink-0 bg-[#0B1F3A] flex flex-col h-full">
      <div className="h-20 px-6 flex items-center gap-3 border-b border-white/10">
        <div className="w-8 h-8 rounded bg-[#1769E0] flex items-center justify-center">
          <span className="text-white font-bold text-xs">CX</span>
        </div>
        <div>
          <p className="font-label-md text-white">Compex Solution</p>
          <p className="font-body-sm text-[#7587a7] text-xs">ERP Dashboard</p>
        </div>
      </div>

      <div className="flex-grow px-4 py-6 space-y-6 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="font-label-sm text-[#7587a7] uppercase tracking-wider px-3 mb-3">{group.label}</p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.disabled ? "#" : item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded font-label-md transition-colors",
                  item.disabled
                    ? "text-[#7587a7]/50 cursor-not-allowed"
                    : isActive(item.href, item.exact)
                    ? "bg-[#1769E0] text-white"
                    : "text-[#7587a7] hover:bg-white/10 hover:text-white"
                )}
                onClick={item.disabled ? (e) => e.preventDefault() : undefined}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.badge && !item.disabled && (
                  <span className="ml-auto bg-[#1769E0] text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
                {item.disabled && (
                  <span className="ml-auto font-label-sm text-[#7587a7]/30 text-[10px]">Soon</span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[#1769E0] flex items-center justify-center text-white font-bold text-sm">
            AR
          </div>
          <div className="min-w-0">
            <p className="font-label-md text-white truncate">Arjun R.</p>
            <p className="font-body-sm text-[#7587a7] text-xs truncate">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}