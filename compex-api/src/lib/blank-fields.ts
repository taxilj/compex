// Edit forms need a way to CLEAR an optional field. `undefined` cannot do it:
// JSON drops it and Prisma treats an absent key as "leave unchanged", so an
// admin who erases a value sees the save succeed while the old value stays.
//
// Clients therefore send an explicit `null` for "clear this". Those keys are
// pulled out BEFORE Zod runs (so null never trips .email()/.url()/.uuid()/
// .optional() rules) and re-applied as real NULLs afterwards.
//
// An empty string is deliberately NOT treated as "clear": it is left in place
// so Zod and the Settings validator still see it and reject it (a blank must
// never be silently persisted, nor pass as a Settings value). Keys in
// requiredKeys are left alone so Zod still rejects null for name/email/MPN,
// and only keys the schema knows about are ever turned into NULL writes.
export function splitBlanks(
  raw: unknown,
  schemaKeys: readonly string[],
  requiredKeys: readonly string[] = [],
): { clean: unknown; cleared: Record<string, null> } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { clean: raw, cleared: {} };
  const clean: Record<string, unknown> = {};
  const cleared: Record<string, null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null && schemaKeys.includes(key) && !requiredKeys.includes(key)) cleared[key] = null;
    else clean[key] = value;
  }
  return { clean, cleared };
}

// Merges the cleared keys back into a validated body for a Prisma write.
// The cast is deliberate: cleared keys are always optional (nullable) columns.
export function withCleared<T extends object>(body: T, cleared: Record<string, null>): T {
  return { ...body, ...cleared } as T;
}
