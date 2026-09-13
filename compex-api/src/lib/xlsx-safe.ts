import * as XLSX from "xlsx";

// `xlsx` is installed from https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
// (see package.json), not the npm registry. Both npm-registry advisories for
// this package — GHSA-4r6h-8v6p-xvw6 (prototype pollution) and
// GHSA-5pgg-2g8v-p4x9 (ReDoS) — state no fixed version was ever published to
// npm and point to this exact CDN as the vendor's own distribution channel.
// Verified before installing: same package name/publisher/license/homepage
// as the registry package (Apache-2.0, sheetjs, https://sheetjs.com/).
// Tarball sha256: 8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8

// Generous above any real BOM/catalog file (which run to a few hundred to a
// few thousand rows), but bounded so a crafted workbook cannot force
// unbounded memory/CPU use during parsing.
const MAX_SHEETS = 10;
const MAX_ROWS = 20_000;
const MAX_CELLS = 500_000;

// Never evaluate or capture formulas. bookVBA is enabled only so a present
// VBA project surfaces in `wb.vbaraw` for the reject-macros check below;
// SheetJS never executes it, and we discard it immediately after checking.
//
// `sheets: 0` and `sheetRows` bound the cost of XLSX.read() itself, not just
// a post-hoc check on its output: only the first sheet is ever populated
// (a huge or maliciously dense sheet elsewhere in the workbook is never
// parsed at all), and row conversion for that sheet stops at MAX_ROWS + 1
// rows regardless of how many rows the file actually claims to have.
const XLSX_READ_OPTS: XLSX.ParsingOptions = {
  cellFormula: false,
  cellHTML: false,
  cellDates: true,
  password: "",
  bookVBA: true,
  sheets: 0,
  // sheetRows counts the header row too, so +2 (not +1) guarantees the
  // converted data-row count is strictly greater than MAX_ROWS whenever the
  // sheet actually has more than MAX_ROWS data rows.
  sheetRows: MAX_ROWS + 2,
};

export class UnsafeWorkbookError extends Error {}

/**
 * Reads the first worksheet of an uploaded .xlsx buffer with hardened
 * options and hard caps on sheet/row/cell count. Throws UnsafeWorkbookError
 * with a generic, customer-safe message for anything malformed, oversized,
 * or macro-enabled — never the raw parser error.
 */
export function readFirstSheetSafely(buffer: Buffer): Record<string, unknown>[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, XLSX_READ_OPTS);
  } catch (err) {
    // Log server-side only: a hostile file and a genuine parser bug must
    // not look identical to us just because the customer only ever sees
    // the safe generic message below.
    console.error("[xlsx-safe] XLSX.read failed:", err);
    throw new UnsafeWorkbookError(
      "Unable to read this spreadsheet file. It may be corrupted or in an unsupported format.",
    );
  }

  // A VBA project blob means the file originated as macro-enabled
  // (.xlsm/.xlsb) even if it was renamed to .xlsx before upload. Reject and
  // discard it — we never read, store, or round-trip this blob.
  if (wb.vbaraw) {
    throw new UnsafeWorkbookError("Macro-enabled spreadsheets are not supported. Please save as a standard .xlsx file.");
  }

  if (wb.SheetNames.length === 0) {
    throw new UnsafeWorkbookError("This spreadsheet has no sheets.");
  }
  if (wb.SheetNames.length > MAX_SHEETS) {
    throw new UnsafeWorkbookError(`This spreadsheet has too many sheets (max ${MAX_SHEETS}).`);
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    throw new UnsafeWorkbookError(
      "Unable to read this spreadsheet file. It may be corrupted or in an unsupported format.",
    );
  }

  let raw: Record<string, unknown>[];
  try {
    raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  } catch (err) {
    console.error("[xlsx-safe] sheet_to_json failed:", err);
    throw new UnsafeWorkbookError(
      "Unable to read this spreadsheet file. It may be corrupted or in an unsupported format.",
    );
  }

  // sheetRows above caps actual parsing at MAX_ROWS + 2 (including the
  // header row) — getting back more than MAX_ROWS data rows here means the
  // real file exceeds the limit; parsing itself never went further than
  // that bound either way.
  if (raw.length > MAX_ROWS) {
    throw new UnsafeWorkbookError(`This spreadsheet has too many rows (max ${MAX_ROWS}).`);
  }

  const totalCells = raw.reduce((sum, row) => sum + Object.keys(row).length, 0);
  if (totalCells > MAX_CELLS) {
    throw new UnsafeWorkbookError(`This spreadsheet is too large to process (max ${MAX_CELLS} cells).`);
  }

  return raw;
}
