import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { TimelineStep } from "@/types";

interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function Timeline({ steps, className }: TimelineProps) {
  return (
    <ol className={cn("relative space-y-0", className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={i} className="flex gap-4">
            {/* Connector column */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10",
                  step.completed
                    ? "bg-[#1769E0] border-[#1769E0] text-white"
                    : step.current
                    ? "bg-white border-[#1769E0] text-[#1769E0]"
                    : "bg-white border-[#E4E7EC] text-[#44474d]"
                )}
              >
                {step.completed ? (
                  <Check size={14} />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-current" />
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-8 my-1",
                    step.completed ? "bg-[#1769E0]" : "bg-[#E4E7EC]"
                  )}
                />
              )}
            </div>
            {/* Content */}
            <div className={cn("pb-6", isLast && "pb-0")}>
              <p className={cn("font-label-md", step.completed ? "text-[#111c2d]" : "text-[#44474d]")}>
                {step.label}
              </p>
              {step.date && (
                <p className="font-body-sm text-[#44474d] mt-0.5">{step.date}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
