"use client";

import type { ContactEntry } from "@/lib/api/admin";
import { Field } from "./Field";

const fields = [
  ["name", "Name"], ["shortName", "Short name"], ["email", "Email"],
  ["phone", "Phone"], ["mobile", "Mobile"], ["status", "Status"],
  ["division", "Division"], ["position", "Position"], ["remarks", "Remarks"],
] as const;

export function ContactGrid({ value, onChange }: { value: ContactEntry[]; onChange: (rows: ContactEntry[]) => void }) {
  function update(index: number, key: typeof fields[number][0], text: string) {
    onChange(value.map((row, i) => i === index ? {
      ...row, [key]: key === "name" ? text : text || undefined,
      ...(key === "position" && row.role !== undefined ? { role: text || undefined } : {}),
    } : row));
  }
  return (
    <fieldset className="rounded-lg border border-[#E4E7EC] p-3 space-y-4">
      <legend className="px-1 font-label-md">Contact list</legend>
      {value.map((row, index) => (
        <div key={index} className="space-y-3 border-b border-[#E4E7EC] pb-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {fields.map(([key, label]) => (
              <Field key={key} label={`Contact ${index + 1} ${label}`} value={(key === "position" ? row.position ?? row.role : row[key]) ?? ""} onChange={(text) => update(index, key, text)} required={key === "name"} type={key === "email" ? "email" : "text"} />
            ))}
          </div>
          <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))} className="text-sm text-[#B42318] underline">Remove contact {index + 1}</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { name: "" }])} disabled={value.length >= 50} className="text-sm text-[#1769E0] underline disabled:opacity-50">Add contact</button>
    </fieldset>
  );
}
