import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import type { CatalogFetcher, RawCatalogItem } from "../types.js";

// Same safety options as bom-processor.ts: no formula evaluation, no macros.
const XLSX_READ_OPTS: XLSX.ParsingOptions = { cellFormula: false, cellHTML: false, cellDates: true, password: "" };

const HEADER_MAP: Record<string, keyof RawCatalogItem> = {
  mpn: "mpn",
  partnumber: "mpn",
  "part#": "mpn",
  mfr: "manufacturer",
  manufacturer: "manufacturer",
  mfgr: "manufacturer",
  name: "name",
  producttitle: "name",
  title: "name",
  desc: "description",
  description: "description",
  category: "category",
  subcategory: "category",
  package: "packageType",
  packagetype: "packageType",
  mounting: "mountingType",
  mountingtype: "mountingType",
  lifecycle: "lifecycleStatus",
  lifecyclestatus: "lifecycleStatus",
  status: "lifecycleStatus",
  datasheet: "datasheetUrl",
  datasheeturl: "datasheetUrl",
  sourceid: "sourceProductId",
  sourceproductid: "sourceProductId",
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]+/g, "");
}

function mapRow(row: Record<string, unknown>): RawCatalogItem {
  const out: Partial<RawCatalogItem> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = HEADER_MAP[normalizeHeader(k)];
    if (key && v !== undefined && v !== "") (out as Record<string, unknown>)[key] = String(v).trim();
  }
  return out as RawCatalogItem;
}

// Admin-uploaded CSV/XLSX — the only fetcher shipped in this pass. It's the
// admin's own curated data (not a scrape of any third party), and the whole
// file fits in memory, so it's always a single page (nextCursor stays
// undefined). Reuses the parsing libraries already used by bom-processor.ts.
export function createCsvFetcher(buffer: Buffer, ext: ".csv" | ".xlsx"): CatalogFetcher {
  return {
    source: "MANUAL_CSV",
    async fetch() {
      const rows: Record<string, unknown>[] =
        ext === ".csv"
          ? (parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[])
          : (() => {
              const wb = XLSX.read(buffer, XLSX_READ_OPTS);
              const ws = wb.Sheets[wb.SheetNames[0]];
              return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
            })();
      return { items: rows.map(mapRow) };
    },
  };
}
