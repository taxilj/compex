import { describe, it, expect, vi, type Mock } from "vitest";
import * as XLSX from "xlsx";

vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof XLSX>();
  return { ...actual, read: vi.fn(actual.read) };
});

import { readFirstSheetSafely, UnsafeWorkbookError } from "../../src/lib/xlsx-safe.js";

function realWorkbookBuffer(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function mockRead(fakeWorkbook: unknown) {
  (XLSX.read as unknown as Mock).mockReturnValueOnce(fakeWorkbook);
}

describe("readFirstSheetSafely", () => {
  it("parses a valid XLSX workbook into row objects", () => {
    const buf = realWorkbookBuffer([
      { mpn: "STM32F103C8T6", quantity: 10 },
      { mpn: "LM324N", quantity: 5 },
    ]);
    const rows = readFirstSheetSafely(buf);
    expect(rows).toEqual([
      { mpn: "STM32F103C8T6", quantity: 10 },
      { mpn: "LM324N", quantity: 5 },
    ]);
  });

  it("rejects a corrupted zip archive with a safe, generic message", () => {
    // A real xlsx has valid PK magic bytes but a truncated/corrupted zip
    // body — this passes the upload layer's magic-byte check yet still
    // fails to actually parse, which is exactly the "corrupted archive"
    // case the parser must fail closed on rather than crash or hang.
    const real = realWorkbookBuffer([{ mpn: "STM32F103C8T6" }]);
    const corrupted = real.subarray(0, Math.floor(real.length / 2));
    expect(() => readFirstSheetSafely(corrupted)).toThrow(UnsafeWorkbookError);
    expect(() => readFirstSheetSafely(corrupted)).toThrow(/unable to read this spreadsheet/i);
  });

  it("rejects a workbook with a VBA project (macro-enabled) without reading its contents", () => {
    mockRead({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: { "!ref": "A1:B2" } },
      vbaraw: Buffer.from("fake vba project blob"),
    });
    expect(() => readFirstSheetSafely(Buffer.from("irrelevant"))).toThrow(/macro-enabled/i);
  });

  it("rejects a workbook with no sheets", () => {
    mockRead({ SheetNames: [], Sheets: {} });
    expect(() => readFirstSheetSafely(Buffer.from("irrelevant"))).toThrow(/no sheets/i);
  });

  it("rejects a workbook with more than the maximum allowed sheets", () => {
    const sheetNames = Array.from({ length: 11 }, (_, i) => `Sheet${i + 1}`);
    const sheets = Object.fromEntries(sheetNames.map((n) => [n, { "!ref": "A1:A1" }]));
    mockRead({ SheetNames: sheetNames, Sheets: sheets });
    expect(() => readFirstSheetSafely(Buffer.from("irrelevant"))).toThrow(/too many sheets/i);
  });

  it("rejects a sheet with more than the maximum allowed rows (real file, exercises sheetRows truncation)", () => {
    // 20,001 real data rows > the 20,000 cap. This is a real buffer, not a
    // mock, so it also proves the `sheetRows` read option actually engages
    // rather than XLSX.read parsing every row before we ever check.
    const aoa = [["mpn"], ...Array.from({ length: 20_001 }, (_, i) => [`MPN-${i}`])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    expect(() => readFirstSheetSafely(buf)).toThrow(/too many rows/i);
  });

  it("rejects a sheet whose total cell count exceeds the maximum cap, even under the row cap", () => {
    // 100 rows x 6,000 columns = 600,000 cells > 500,000 cap, well under the
    // 20,000 row cap — proves the cell-count check is independent of rows.
    const header = Array.from({ length: 6000 }, (_, i) => `col${i}`);
    const aoa = [header, ...Array.from({ length: 100 }, () => header.map((_, i) => i))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    expect(() => readFirstSheetSafely(buf)).toThrow(/too large to process/i);
  });

  it("does not evaluate formulas — formula text is never present on parsed rows", () => {
    const ws = XLSX.utils.aoa_to_sheet([["mpn"], ["STM32F103C8T6"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const rows = readFirstSheetSafely(buf);
    for (const row of rows) {
      expect(Object.keys(row)).not.toContain("f");
    }
  });

  it("never leaks the raw parser error message to the caller", () => {
    (XLSX.read as unknown as Mock).mockImplementationOnce(() => {
      throw new Error("internal libxlsx stack trace with a file path and memory address 0xDEADBEEF");
    });
    try {
      readFirstSheetSafely(Buffer.from("irrelevant"));
      expect.fail("expected readFirstSheetSafely to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UnsafeWorkbookError);
      expect((err as Error).message).not.toMatch(/0xDEADBEEF|libxlsx/);
    }
  });
});
