import { CheckCircle2, X } from "lucide-react";

interface SuccessNoticeProps {
  message: string;
  onDismiss: () => void;
}

export function SuccessNotice({ message, onDismiss }: SuccessNoticeProps) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded border border-[#12B76A]/30 bg-[#ECFDF3] px-4 py-3 text-[#027A48]">
      <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} aria-hidden="true" />{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="rounded p-1 hover:bg-[#12B76A]/10"><X size={14} /></button>
    </div>
  );
}
