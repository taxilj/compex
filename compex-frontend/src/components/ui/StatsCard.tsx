import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatsCard({ label, value, icon: Icon, iconClassName, trend, trendUp, className }: StatsCardProps) {
  return (
    <div className={cn("bg-white p-6 rounded-lg shadow-sm border border-[#E4E7EC] flex flex-col hover:-translate-y-0.5 transition-transform duration-300", className)}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2 bg-[#e8eeff] rounded", iconClassName)}>
          <Icon size={24} className="text-[#0B1F3A]" />
        </div>
      </div>
      <p className="font-label-sm text-[#44474d] uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="font-headline-lg text-[#111c2d]">{value}</h3>
        {trend && (
          <span className={cn("text-xs font-medium", trendUp ? "text-[#12B76A]" : "text-[#F04438]")}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
