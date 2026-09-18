import { prisma } from "../src/lib/prisma.js";
import { importDigiKeyStarterCatalog } from "../src/modules/catalog-import/digikey-starter-catalog-import.js";

const pagesPerCategory = Number.parseInt(process.argv[2] ?? "1", 10);
if (!Number.isInteger(pagesPerCategory) || pagesPerCategory < 1 || pagesPerCategory > 4) {
  throw new Error("pagesPerCategory must be an integer from 1 to 4");
}

try {
  const result = await importDigiKeyStarterCatalog(pagesPerCategory);
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
