"use client";

import { useMemo, useState } from "react";
import CTABanner from "@/components/ui/CTABanner";

type OhmField = "voltage" | "current" | "resistance";

const LENGTH_UNITS = {
  mm: 1,
  cm: 10,
  m: 1000,
  inch: 25.4,
  mil: 0.0254,
  ft: 304.8,
} as const;
type LengthUnit = keyof typeof LENGTH_UNITS;

function OhmsLawCalculator() {
  const [values, setValues] = useState<Record<OhmField, string>>({ voltage: "", current: "", resistance: "" });
  const [solvedFor, setSolvedFor] = useState<OhmField | null>(null);

  function update(field: OhmField, raw: string) {
    setValues((prev) => ({ ...prev, [field]: raw }));
    setSolvedFor(null);
  }

  function solve() {
    const v = parseFloat(values.voltage);
    const i = parseFloat(values.current);
    const r = parseFloat(values.resistance);

    if (isNaN(v) && !isNaN(i) && !isNaN(r)) {
      setValues({ ...values, voltage: (i * r).toFixed(4) });
      setSolvedFor("voltage");
    } else if (isNaN(i) && !isNaN(v) && !isNaN(r)) {
      setValues({ ...values, current: (r === 0 ? 0 : v / r).toFixed(6) });
      setSolvedFor("current");
    } else if (isNaN(r) && !isNaN(v) && !isNaN(i)) {
      setValues({ ...values, resistance: (i === 0 ? 0 : v / i).toFixed(4) });
      setSolvedFor("resistance");
    } else if (!isNaN(v) && !isNaN(i) && !isNaN(r)) {
      // all three present — recompute voltage from I and R as the canonical result
      setValues({ ...values, voltage: (i * r).toFixed(4) });
      setSolvedFor("voltage");
    }
  }

  function reset() {
    setValues({ voltage: "", current: "", resistance: "" });
    setSolvedFor(null);
  }

  const fields: { key: OhmField; label: string; unit: string }[] = [
    { key: "voltage", label: "Voltage", unit: "V" },
    { key: "current", label: "Current", unit: "A" },
    { key: "resistance", label: "Resistance", unit: "Ω" },
  ];

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-xl p-6">
      <h2 className="font-headline-sm text-[#0B1F3A] mb-1.5">Ohm&apos;s Law</h2>
      <p className="font-body-sm text-[#44474d] mb-6">Enter any two values (V, I, R) and solve for the third.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label htmlFor={`ohm-${f.key}`} className="font-label-sm text-[#44474d] uppercase block mb-1.5">
              {f.label} ({f.unit})
            </label>
            <input
              id={`ohm-${f.key}`}
              type="number"
              value={values[f.key]}
              onChange={(event) => update(f.key, event.target.value)}
              className={`w-full border rounded px-3 py-2 font-mono-label text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#1769E0] ${
                solvedFor === f.key ? "border-[#1769E0] bg-[#f0f3ff]" : "border-[#E4E7EC]"
              }`}
              placeholder="—"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={solve}
          className="bg-[#1769E0] text-white px-5 py-2.5 rounded font-label-md hover:bg-[#1257b8] transition-colors"
        >
          Solve
        </button>
        <button
          type="button"
          onClick={reset}
          className="border border-[#E4E7EC] text-[#44474d] px-5 py-2.5 rounded font-label-md hover:bg-[#f9f9ff] transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function UnitConverter() {
  const [value, setValue] = useState("1");
  const [from, setFrom] = useState<LengthUnit>("mm");
  const [to, setTo] = useState<LengthUnit>("inch");

  const result = useMemo(() => {
    const n = parseFloat(value);
    if (isNaN(n)) return null;
    const mm = n * LENGTH_UNITS[from];
    return mm / LENGTH_UNITS[to];
  }, [value, from, to]);

  return (
    <div className="bg-white border border-[#E4E7EC] rounded-xl p-6">
      <h2 className="font-headline-sm text-[#0B1F3A] mb-1.5">Unit Converter</h2>
      <p className="font-body-sm text-[#44474d] mb-6">Convert between length units used in package and footprint specs.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <label htmlFor="unit-value" className="font-label-sm text-[#44474d] uppercase block mb-1.5">Value</label>
          <input
            id="unit-value"
            type="number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-full border border-[#E4E7EC] rounded px-3 py-2 font-mono-label text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
          />
        </div>
        <div>
          <label htmlFor="unit-from" className="font-label-sm text-[#44474d] uppercase block mb-1.5">From</label>
          <select
            id="unit-from"
            value={from}
            onChange={(event) => setFrom(event.target.value as LengthUnit)}
            className="w-full border border-[#E4E7EC] rounded px-3 py-2 font-mono-label text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
          >
            {Object.keys(LENGTH_UNITS).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="unit-to" className="font-label-sm text-[#44474d] uppercase block mb-1.5">To</label>
          <select
            id="unit-to"
            value={to}
            onChange={(event) => setTo(event.target.value as LengthUnit)}
            className="w-full border border-[#E4E7EC] rounded px-3 py-2 font-mono-label text-[#111c2d] focus:outline-none focus:ring-1 focus:ring-[#1769E0]"
          >
            {Object.keys(LENGTH_UNITS).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 pt-5 border-t border-[#E4E7EC]">
        <span className="font-label-sm text-[#44474d] uppercase">Result</span>
        <p className="font-mono-label text-[#0B1F3A] text-lg mt-1">
          {result === null ? "—" : `${result.toPrecision(6).replace(/\.?0+$/, "")} ${to}`}
        </p>
      </div>
    </div>
  );
}

export default function CalculatorsPage() {
  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Tools · Calculators</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">
            Engineering Calculators
          </h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Quick reference calculators for everyday component-selection math.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OhmsLawCalculator />
          <UnitConverter />
        </div>
      </section>

      <CTABanner />
    </div>
  );
}
