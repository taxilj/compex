import { prisma } from "../../lib/prisma.js";
import { createDigiKeyStarterCatalogFetcher, type DigiKeyStarterCatalogTarget } from "./fetchers/digikey-fetcher.js";
import { runImport } from "./run-import.js";

export const DIGIKEY_STARTER_CATALOG_IMPORT_SOURCE = "DIGIKEY_STARTER_CATALOG";

// One focused, official search per public main category. These are product
// search terms, not fabricated product data. Imported rows retain their
// original DigiKey manufacturer, MPN, datasheet, image and provenance; only
// the category is aligned to COMPEX's public main-category navigation.
export const DIGIKEY_STARTER_CATALOG_TARGETS: DigiKeyStarterCatalogTarget[] = [
  { categoryName: "Automation & Control", keywords: "programmable logic controller" },
  { categoryName: "Cables, Wires", keywords: "cable" },
  { categoryName: "Circuit Protection", keywords: "fuse" },
  { categoryName: "Connectors", keywords: "connector" },
  { categoryName: "Electromechanical", keywords: "relay" },
  { categoryName: "Enclosures, Hardware, Office", keywords: "enclosure" },
  { categoryName: "Fans, Thermal Management", keywords: "fan" },
  { categoryName: "Integrated Circuits (ICs)", keywords: "integrated circuit" },
  { categoryName: "LED/Optoelectronics", keywords: "LED" },
  { categoryName: "Passives", keywords: "resistor" },
  { categoryName: "Power", keywords: "power supply" },
  { categoryName: "RF and Wireless", keywords: "antenna" },
  { categoryName: "Semiconductors", keywords: "transistor" },
  { categoryName: "Sensors, Transducers", keywords: "sensor" },
  { categoryName: "Test and Measurement", keywords: "multimeter" },
  { categoryName: "Tools", keywords: "soldering iron" },
];

export interface DigiKeyStarterCatalogImportResult {
  categories: number;
  pagesPerCategory: number;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsFailed: number;
  runIds: string[];
}

// Imports a bounded starter catalogue. A complete distributor catalogue needs
// a separate licensed feed / synchronization agreement; this deliberately
// never masquerades as such a feed or makes unbounded calls to a search API.
export async function importDigiKeyStarterCatalog(pagesPerCategory: number): Promise<DigiKeyStarterCatalogImportResult> {
  const result: DigiKeyStarterCatalogImportResult = {
    categories: DIGIKEY_STARTER_CATALOG_TARGETS.length,
    pagesPerCategory,
    itemsProcessed: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    itemsFailed: 0,
    runIds: [],
  };

  for (const target of DIGIKEY_STARTER_CATALOG_TARGETS) {
    const fetcher = createDigiKeyStarterCatalogFetcher(target, pagesPerCategory);
    const run = await prisma.catalogImportRun.create({ data: { source: DIGIKEY_STARTER_CATALOG_IMPORT_SOURCE } });
    result.runIds.push(run.id);

    await runImport(fetcher, run.id);
    const completed = await prisma.catalogImportRun.findUniqueOrThrow({ where: { id: run.id } });
    result.itemsProcessed += completed.itemsProcessed;
    result.itemsCreated += completed.itemsCreated;
    result.itemsUpdated += completed.itemsUpdated;
    result.itemsFailed += completed.itemsFailed;
  }

  return result;
}
