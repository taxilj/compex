"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [attempt, setAttempt] = useState(0);

  // State changes happen inside the setTimeout callback, never
  // synchronously in the effect body -- same pattern as PublicHeader's
  // category fetch, avoids a cascading-render lint violation.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setError(false);
      listSettings(category)
        .then((rows) => { if (!cancelled) setOptions(rows); })
        .catch(() => { if (!cancelled) setError(true); });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [category, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const knownValues = options?.map((o) => o.value) ?? [];
  // Only call a value "(inactive)" once the active list has actually loaded and
  // it is genuinely absent -- while loading we can't know, so show it plainly.
  const showCurrentValue = value && !knownValues.includes(value);
  const currentValueLabel = options ? `${value} (inactive)` : value;

  return (
    <div>
      <label className="block font-label-md text-[#44474d] mb-1.5 text-sm">{label}</label>
      {error ? (
        <div className="py-2 space-y-1">
          <p role="alert" className="font-body-sm text-[#B42318] text-xs">
            Couldn&apos;t load options for &quot;{category}&quot;.
          </p>
          <button type="button" onClick={retry} className="font-label-sm text-[#1769E0] text-xs hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={!options}
          className="w-full border border-[#E4E7EC] rounded px-3 py-2 text-sm disabled:bg-[#f9f9ff]"
        >
          <option value="">{options ? placeholder : "Loading…"}</option>
          {showCurrentValue && <option value={value}>{currentValueLabel}</option>}
          {options?.map((o) => (
            <option key={o.id} value={o.value}>{o.value}</option>
          ))}
        </select>
      )}
    </div>
  );
}
