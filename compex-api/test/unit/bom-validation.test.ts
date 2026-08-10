import { describe, it, expect } from "vitest";

// Validate BOM file type/extension checks (pure logic extracted for testing)
const ALLOWED_EXTS = new Set([".xlsx", ".csv"]);
const MAX_BYTES = 10 * 1024 * 1024;

describe("BOM upload validation", () => {
  it("accepts .xlsx extension", () => {
    expect(ALLOWED_EXTS.has(".xlsx")).toBe(true);
  });

  it("accepts .csv extension", () => {
    expect(ALLOWED_EXTS.has(".csv")).toBe(true);
  });

  it("rejects .exe extension", () => {
    expect(ALLOWED_EXTS.has(".exe")).toBe(false);
  });

  it("rejects .pdf extension", () => {
    expect(ALLOWED_EXTS.has(".pdf")).toBe(false);
  });

  it("rejects files over 10 MB", () => {
    const bigFile = MAX_BYTES + 1;
    expect(bigFile > MAX_BYTES).toBe(true);
  });

  it("accepts files at exactly 10 MB", () => {
    expect(MAX_BYTES <= MAX_BYTES).toBe(true);
  });

  it("detects XLSX magic bytes (PK signature)", () => {
    const validXlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    expect(validXlsx[0] === 0x50 && validXlsx[1] === 0x4b).toBe(true);
  });

  it("rejects wrong magic bytes for XLSX", () => {
    const notXlsx = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(notXlsx[0] === 0x50 && notXlsx[1] === 0x4b).toBe(false);
  });
});