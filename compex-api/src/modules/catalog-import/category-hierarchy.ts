// Read-only validation of the owner "Category" sheet (KAS CRM.xlsx), India scheme:
// columns A-C = Product Group > Product Category > leaf, column D = HSN. Nothing
// here writes to the database. The sheet cannot be imported as-is (see
// docs/CATEGORY-HIERARCHY-IMPORT.md), so this reports exactly what blocks it
// instead of guessing a resolution.

export interface CategorySheetRow {
  line: number; // 1-based sheet row
  group: string;
  category: string;
  leaf: string;
  hsn: string | null;
}

export type HierarchyIssueCode = "MISSING_LEVEL" | "DUPLICATE_PATH" | "NAME_AT_MANY_POSITIONS" | "EXISTING_NAME_IN_SHEET";

export interface HierarchyIssue {
  code: HierarchyIssueCode;
  message: string;
  names: string[];
}

export interface HierarchyReport {
  rows: number;
  groups: number;
  categories: number;
  leaves: number;
  blocking: HierarchyIssue[]; // would break the unique Category.name constraint or a row
  review: HierarchyIssue[]; // needs an owner mapping decision
}

const cell = (value: unknown) => String(value ?? "").trim();

// `rows` is the sheet as an array of arrays; the first two rows are title + header.
export function parseIndiaRows(rows: unknown[][], firstDataLine = 3): CategorySheetRow[] {
  return rows.slice(firstDataLine - 1).flatMap((row, index) => {
    const parsed = { group: cell(row[0]), category: cell(row[1]), leaf: cell(row[2]) };
    if (!parsed.group && !parsed.category && !parsed.leaf) return [];
    return [{ line: firstDataLine + index, ...parsed, hsn: cell(row[3]) || null }];
  });
}

export function validateHierarchy(rows: CategorySheetRow[], existingNames: string[] = []): HierarchyReport {
  const blocking: HierarchyIssue[] = [];
  const review: HierarchyIssue[] = [];

  const incomplete = rows.filter((r) => !r.group || !r.category || !r.leaf);
  if (incomplete.length) {
    blocking.push({ code: "MISSING_LEVEL", message: `${incomplete.length} row(s) lack a group, category or leaf`, names: incomplete.map((r) => `row ${r.line}`) });
  }
  const complete = rows.filter((r) => r.group && r.category && r.leaf);

  const seenPaths = new Set<string>();
  const duplicatePaths: string[] = [];
  for (const r of complete) {
    const path = [r.group, r.category, r.leaf].join(" > ");
    if (seenPaths.has(path)) duplicatePaths.push(path);
    seenPaths.add(path);
  }
  if (duplicatePaths.length) {
    blocking.push({ code: "DUPLICATE_PATH", message: `${duplicatePaths.length} repeated group > category > leaf path(s)`, names: duplicatePaths });
  }

  // Category.name is globally unique, so one name can occupy only one position in the tree.
  const positions = new Map<string, Set<string>>();
  const place = (name: string, position: string) => positions.set(name, (positions.get(name) ?? new Set()).add(position));
  for (const r of complete) {
    place(r.group, "group");
    place(r.category, `category of ${r.group}`);
    place(r.leaf, `leaf of ${r.group} > ${r.category}`);
  }
  const reused = [...positions].filter(([, where]) => where.size > 1).map(([name]) => name);
  if (reused.length) {
    blocking.push({ code: "NAME_AT_MANY_POSITIONS", message: `${reused.length} name(s) appear at more than one position`, names: reused });
  }

  const live = existingNames.filter((name) => positions.has(name));
  if (live.length) {
    review.push({
      code: "EXISTING_NAME_IN_SHEET",
      message: `${live.length} live flat categor${live.length === 1 ? "y is" : "ies are"} also in the sheet; importing would re-parent or duplicate them`,
      names: live.map((name) => `${name} (${[...positions.get(name)!].join(" / ")})`),
    });
  }

  return {
    rows: rows.length,
    groups: new Set(complete.map((r) => r.group)).size,
    categories: new Set(complete.map((r) => `${r.group}>${r.category}`)).size,
    leaves: seenPaths.size,
    blocking,
    review,
  };
}
