import { prisma } from "./prisma.js";
import { Errors } from "./errors.js";

// Validates that a submitted value, if present, is a real, currently-active
// LOV entry for the given Settings category -- the server-side half of
// "every dropdown loads from Settings" (the client-side half is the
// SettingsSelect component, which only ever offers active values in the
// first place). Empty/undefined is always allowed since these fields are
// optional; this only rejects a value that does not match a configured
// option, so a form can never silently drift a Settings-backed field into
// arbitrary free text.
//
// A value that used to be active and was since deactivated is intentionally
// NOT accepted here (assigning a retired option to a *new* record would
// defeat the point of deactivating it) -- but existing records that already
// stored it are completely unaffected, since reads never re-validate
// against Settings, only writes do.
export async function assertValidSettingValue(category: string, value: string | null | undefined): Promise<void> {
  if (value === null || value === undefined || value === "") return;
  const exists = await prisma.setting.findFirst({ where: { category, value, isActive: true }, select: { id: true } });
  if (!exists) {
    throw Errors.validation(`"${value}" is not a configured, active value for "${category}". Add or reactivate it in Settings first.`);
  }
}

// Runs several category/value checks in parallel -- callers pass only the
// fields that were actually present on the request body (a PATCH omits
// untouched fields; Object.entries would otherwise re-validate stale values
// that weren't part of this submission).
export async function assertValidSettingValues(checks: Array<{ category: string; value: string | null | undefined }>): Promise<void> {
  await Promise.all(checks.map((c) => assertValidSettingValue(c.category, c.value)));
}
