"use client";

export function Field({
  label,
  value,
  onChange,
  required,
  disabled,
  textarea,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} rows={3} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm disabled:bg-[#f9f9ff]" />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm disabled:bg-[#f9f9ff]" />
      )}
    </div>
  );
}
