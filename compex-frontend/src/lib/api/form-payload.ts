const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

// Create: send only fields that have a value. A blank optional field must be
// omitted, not sent as "" -- the server rejects "" for Settings-backed fields
// and for email/url-validated ones.
export function createPayload<T extends object>(form: T): T {
  return Object.fromEntries(Object.entries(form).filter(([, v]) => !isBlank(v))) as T;
}

// Update: send only fields the admin actually changed, with an explicit
// `null` when a value was erased. The server turns null into a real NULL (so a
// field can genuinely be cleared -- `undefined` is dropped by JSON.stringify
// and would silently leave the old value), and it never re-validates fields
// that are not sent, so an unrelated edit can't be blocked by a since-
// deactivated Settings value the record already holds.
//
// The return type says Partial<T> to fit the typed API functions even though
// cleared fields are null; the backend contract (see blank-fields.ts) is what
// makes that safe.
export function updatePayload<T extends object>(form: T, original: T): Partial<T> {
  const before = original as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(form)) {
    const next = isBlank(value) ? null : value;
    const prev = isBlank(before[key]) ? null : before[key];
    if (next !== prev) out[key] = next;
  }
  return out as Partial<T>;
}
