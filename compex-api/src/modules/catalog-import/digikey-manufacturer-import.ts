import { prisma } from "../../lib/prisma.js";
import { slugify } from "./normalizer.js";
import { fetchDigiKeyManufacturers } from "./fetchers/digikey-fetcher.js";

export const DIGIKEY_MANUFACTURER_IMPORT_SOURCE = "DIGIKEY_MANUFACTURERS";
export const DIGIKEY_MANUFACTURER_SOURCE_URL = "https://www.digikey.com/en/supplier-centers/mfg-linecard";

const BATCH_SIZE = 500;

export interface DigiKeyManufacturerImportResult {
  retrieved: number;
  created: number;
  existing: number;
  skipped: number;
}

// The DigiKey response supplies only a stable numeric ID and a display name.
// Do not overwrite locally curated manufacturer details with that sparse data.
// Existing slugs are therefore retained exactly as staff entered them.
export async function importDigiKeyManufacturers(): Promise<DigiKeyManufacturerImportResult> {
  const manufacturers = await fetchDigiKeyManufacturers();
  const uniqueBySlug = new Map<string, string>();
  let skipped = 0;

  for (const manufacturer of manufacturers) {
    const slug = slugify(manufacturer.name);
    if (!slug || slug.length > 100 || uniqueBySlug.has(slug)) {
      skipped += 1;
      continue;
    }
    uniqueBySlug.set(slug, manufacturer.name);
  }

  const entries = [...uniqueBySlug.entries()].map(([slug, name]) => ({ slug, name }));
  let created = 0;

  for (let index = 0; index < entries.length; index += BATCH_SIZE) {
    const batch = entries.slice(index, index + BATCH_SIZE);
    const result = await prisma.manufacturer.createMany({
      data: batch.map(({ slug, name }) => ({
        name,
        slug,
        source: "DIGIKEY",
        sourceUrl: DIGIKEY_MANUFACTURER_SOURCE_URL,
      })),
      skipDuplicates: true,
    });
    created += result.count;
  }

  return {
    retrieved: manufacturers.length,
    created,
    existing: entries.length - created,
    skipped,
  };
}
