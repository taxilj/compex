// Read-only: validates the owner "Category" sheet against the Category table rules and
// prints what blocks an import. Writes nothing (no database, no files).
//   npm run catalog:check-hierarchy -- "<path to KAS CRM.xlsx>" [live-category-names.json]
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { parseIndiaRows, validateHierarchy, type HierarchyIssue } from "../src/modules/catalog-import/category-hierarchy.js";

const [workbookPath, liveNamesPath] = process.argv.slice(2);
if (!workbookPath) {
  console.error('usage: npm run catalog:check-hierarchy -- "<workbook.xlsx>" [live-category-names.json]');
  process.exit(2);
}

const sheet = XLSX.read(readFileSync(workbookPath), { type: "buffer", sheets: ["Category"] }).Sheets["Category"];
if (!sheet) {
  console.error('the workbook has no "Category" sheet');
  process.exit(2);
}
const rows = parseIndiaRows(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }));
const liveNames = liveNamesPath ? (JSON.parse(readFileSync(liveNamesPath, "utf8")) as string[]) : [];
const report = validateHierarchy(rows, liveNames);

const show = (issue: HierarchyIssue) => {
  console.log(`  [${issue.code}] ${issue.message}`);
  for (const name of issue.names) console.log(`    - ${name}`);
};
console.log(`rows=${report.rows} groups=${report.groups} categories=${report.categories} leaves=${report.leaves}`);
console.log(`blocking issues: ${report.blocking.length}`);
report.blocking.forEach(show);
console.log(`needs owner decision: ${report.review.length}`);
report.review.forEach(show);
process.exit(report.blocking.length ? 1 : 0);
