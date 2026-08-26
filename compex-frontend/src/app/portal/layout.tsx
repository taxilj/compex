"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalSidebar } from "@/components/layout/PortalSidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2, Menu, X, Plus, LogOut } from "lucide-react";
import Link from "next/link";

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && user.role !== "CUSTOMER") router.replace("/admin");
  }, [isLoading, router, user]);

  if (isLoading || !user || user.role !== "CUSTOMER") {
    return <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={22} /> Checking access…</div>;
  }

  return (
    <div className="flex h-screen bg-[#F7F9FC] overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:flex lg:translate-x-0 transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <PortalSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
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
            href="/portal/rfqs/new"
            className="flex items-center gap-2 bg-[#0B1F3A] text-white px-4 py-2 rounded font-label-md hover:bg-[#0B1F3A]/90 transition-colors text-sm"
          >
            <Plus size={16} />
            New RFQ
          </Link>
          <button
            onClick={() => void logout()}
            className="p-2 text-[#44474d] hover:text-[#0B1F3A] transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={20} />
          </button>
        </header>

        <div className="flex-1 p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </AuthProvider>
  );
}
