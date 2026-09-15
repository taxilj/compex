"use client";

import { useEffect, useState } from "react";
import { listSettings, type Setting } from "@/lib/api/admin";

// The single place every admin form gets a Settings-backed dropdown from --
// no admin form should hardcode LOV values (owner requirement). Always
// fetches active-only values (server default), stable-ordered by the
// backend's [category asc, sortOrder asc, value asc]. A value the record
// already holds (e.g. since deactivated) is always kept selectable so
// editing an existing record never silently drops its current value.
export function SettingsSelect({
  category,
  value,
  onChange,
  label,
  required,
  placeholder = "—",
}: {
  category: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [options, setOptions] = useState<Setting[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSettings(category)
      .then((rows) => { if (!cancelled) setOptions(rows); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [category]);

  const knownValues = options?.map((o) => o.value) ?? [];
  const showCurrentValue = value && !knownValues.includes(value);

  return (
    <div>
      <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">{label}</label>
      {error ? (
        <p role="alert" className="font-body-sm text-[#B42318] text-xs py-2">
          Couldn&apos;t load options for &quot;{category}&quot;. Add values in Settings first.
        </p>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={!options}
          className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm disabled:bg-[#f9f9ff]"
        >
          <option value="">{options ? placeholder : "Loading…"}</option>
          {showCurrentValue && <option value={value}>{value} (inactive)</option>}
          {options?.map((o) => (
            <option key={o.id} value={o.value}>{o.value}</option>
          ))}
        </select>
      )}
    </div>
  );
}
