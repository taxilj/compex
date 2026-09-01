"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Menu, X } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/login");
    else if (user.role === "CUSTOMER") router.replace("/portal");
  }, [isLoading, router, user]);

  if (isLoading || !user || user.role === "CUSTOMER") {
    return <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] text-[#44474d]"><Loader2 className="mr-2 animate-spin" size={22} /> Checking access…</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F9FC]">
      {sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <AdminSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[#E4E7EC] bg-white px-4 md:px-8">
          <button className="p-1 text-[#44474d] lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle navigation">
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <p className="flex-1 font-body-sm text-[#44474d]">Authenticated {user.role.toLowerCase()} workspace</p>
          <button onClick={() => void logout()} className="rounded p-2 text-[#44474d] hover:bg-[#f0f3ff] hover:text-[#0B1F3A]" aria-label="Sign out"><LogOut size={20} /></button>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
