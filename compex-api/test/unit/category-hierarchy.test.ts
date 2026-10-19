import { describe, expect, it } from "vitest";
import { parseIndiaRows, validateHierarchy } from "../../src/modules/catalog-import/category-hierarchy.js";

// Synthetic rows shaped like the owner sheet: title row, header row, then data.
const sheet = (...data: unknown[][]) => [["INDIA"], ["Product Group", "Product Category", "HS Code", "HSN"], ...data];

describe("parseIndiaRows", () => {
  it("skips the two heading rows and blank rows, keeps sheet line numbers and HSN as text", () => {
    const rows = parseIndiaRows(sheet(["Alpha", "Beta", "Gamma", 12345678], ["", "", "", ""], ["Alpha", "Beta", "Delta", ""]));
    expect(rows).toEqual([
      { line: 3, group: "Alpha", category: "Beta", leaf: "Gamma", hsn: "12345678" },
      { line: 5, group: "Alpha", category: "Beta", leaf: "Delta", hsn: null },
    ]);
  });
});

describe("validateHierarchy", () => {
  const rows = (...data: unknown[][]) => parseIndiaRows(sheet(...data));

  it("accepts a clean tree and counts each level", () => {
    const report = validateHierarchy(rows(["G1", "C1", "L1"], ["G1", "C1", "L2"], ["G1", "C2", "L3"], ["G2", "C3", "L4"]));
    expect(report).toMatchObject({ rows: 4, groups: 2, categories: 3, leaves: 4, blocking: [], review: [] });
  });

  it("blocks a row with a missing level", () => {
    const report = validateHierarchy(rows(["G1", "C1", "L1"], ["G1", "", "L2"]));
    expect(report.blocking.map((i) => i.code)).toEqual(["MISSING_LEVEL"]);
    expect(report.blocking[0]!.names).toEqual(["row 4"]);
  });

  it("blocks a repeated path", () => {
    const report = validateHierarchy(rows(["G1", "C1", "L1"], ["G1", "C1", "L1"]));
    expect(report.blocking.map((i) => i.code)).toEqual(["DUPLICATE_PATH"]);
  });

  it("blocks a name used under two parents, because Category.name is globally unique", () => {
    const report = validateHierarchy(rows(["G1", "C1", "Shared"], ["G2", "C2", "Shared"]));
    expect(report.blocking).toEqual([expect.objectContaining({ code: "NAME_AT_MANY_POSITIONS", names: ["Shared"] })]);
  });

  it("blocks a name that is both a group and a category", () => {
    const report = validateHierarchy(rows(["Power", "Power", "L1"]));
    expect(report.blocking[0]).toMatchObject({ code: "NAME_AT_MANY_POSITIONS", names: ["Power"] });
  });

  it("flags live flat categories that the sheet would re-parent, with their sheet position", () => {
    const report = validateHierarchy(rows(["G1", "C1", "L1"]), ["C1", "Untouched"]);
    expect(report.blocking).toEqual([]);
    expect(report.review).toEqual([expect.objectContaining({ code: "EXISTING_NAME_IN_SHEET", names: ["C1 (category of G1)"] })]);
  });
});
