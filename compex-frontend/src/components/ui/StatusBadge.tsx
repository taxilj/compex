import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft:        { label: "Draft",        className: "bg-gray-100 text-gray-600" },
  submitted:    { label: "Submitted",    className: "bg-blue-50 text-blue-700" },
  under_review: { label: "Under Review", className: "bg-amber-50 text-amber-700" },
  sourcing:     { label: "Sourcing",     className: "bg-[#23597F]/10 text-[#23597F]" },
  quote_ready:  { label: "Quote Ready",  className: "bg-[#12B76A]/10 text-[#12B76A]" },
  quote_sent:   { label: "Quote Sent",   className: "bg-[#12B76A]/10 text-[#12B76A]" },
  accepted:     { label: "Accepted",     className: "bg-[#12B76A]/10 text-[#12B76A]" },
  rejected:     { label: "Rejected",     className: "bg-[#F04438]/10 text-[#F04438]" },
  processing:   { label: "Processing",   className: "bg-[#23597F]/10 text-[#23597F]" },
  procurement:  { label: "Procurement",  className: "bg-[#23597F]/10 text-[#23597F]" },
  shipped:      { label: "Shipped",      className: "bg-[#1769E0]/10 text-[#1769E0]" },
  delivered:    { label: "Delivered",    className: "bg-[#12B76A]/10 text-[#12B76A]" },
  cancelled:    { label: "Cancelled",    className: "bg-[#F04438]/10 text-[#F04438]" },
  paid:         { label: "Paid",         className: "bg-[#12B76A]/10 text-[#12B76A]" },
  pending:      { label: "Pending",      className: "bg-amber-50 text-amber-700" },
  overdue:      { label: "Overdue",      className: "bg-[#F04438]/10 text-[#F04438]" },
  closed_won:   { label: "Closed (Won)", className: "bg-gray-100 text-gray-600" },
  closed_lost:  { label: "Closed (Lost)",className: "bg-gray-100 text-gray-600" },
  in_transit:   { label: "In Transit",   className: "bg-[#1769E0]/10 text-[#1769E0]" },
  customs:      { label: "Customs",      className: "bg-amber-50 text-amber-700" },
  out_for_delivery: { label: "Out for Delivery", className: "bg-[#12B76A]/10 text-[#12B76A]" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded text-xs font-label-md",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
