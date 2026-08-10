"use client";

import { useState } from "react";
import { PortalSidebar } from "@/components/layout/PortalSidebar";
import { Menu, X, Bell, Plus } from "lucide-react";
import Link from "next/link";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#F7F9FC] overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop fixed, mobile drawer */}
      <div className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:flex lg:translate-x-0 transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <PortalSidebar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Portal header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E4E7EC] flex items-center px-6 gap-4">
          <button
            className="lg:hidden p-1 text-[#44474d]"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex-1" />
          <Link
            href="/request-quote"
            className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors text-sm"
          >
            <Plus size={16} />
            New RFQ
          </Link>
          <button className="p-2 text-[#44474d] hover:text-[#0B1F3A] relative" aria-label="Notifications">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F04438] rounded-full" />
          </button>
        </header>

        <div className="flex-1 p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
