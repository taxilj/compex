import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#F7F9FC] overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-20 bg-white border-b border-[#E4E7EC] flex items-center px-8 gap-4">
          <div className="flex-1">
            <p className="font-body-sm text-[#44474d]">
              Demo data — <span className="text-[#F04438]">not real production data</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1769E0] flex items-center justify-center text-white font-bold text-sm">
              AR
            </div>
          </div>
        </header>
        <div className="flex-1 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
