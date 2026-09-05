import type { RawCatalogItem } from "../types.js";

// Product Information V4 uses OAuth and returns this shape from ProductDetails
// / KeywordSearch. This mapper deliberately excludes MyPricing and all stock
// pricing fields: COMPEX customers see catalog facts and request a quote.
export interface DigiKeyProduct {
  ManufacturerPartNumber?: string;
  DigiKeyProductNumber?: string;
  ProductDescription?: string;
  DetailedDescription?: string;
  Manufacturer?: { Name?: string } | string;
  PrimaryDatasheet?: string;
  PrimaryPhoto?: string;
  ProductUrl?: string;
  RoHSStatus?: string;
  Obsolete?: boolean;
  Category?: { Name?: string } | string;
  Parameters?: Array<{ Parameter?: string; Value?: string }>;
}

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function mapDigiKeyProduct(product: DigiKeyProduct): RawCatalogItem {
  const specifications: Record<string, unknown> = {};
  for (const parameter of product.Parameters ?? []) {
    if (parameter.Parameter && parameter.Value) specifications[parameter.Parameter] = parameter.Value;
  }
  if (product.RoHSStatus) specifications.rohsStatus = product.RoHSStatus;

  const manufacturer = typeof product.Manufacturer === "string" ? product.Manufacturer : product.Manufacturer?.Name;
  const category = typeof product.Category === "string" ? product.Category : product.Category?.Name;
  const packageKey = Object.keys(specifications).find((key) => /package|case/i.test(key));

  return {
    mpn: product.ManufacturerPartNumber?.trim() || "",
    manufacturer,
    description: product.DetailedDescription ?? product.ProductDescription,
    category,
    packageType: packageKey ? String(specifications[packageKey]) : undefined,
    lifecycleStatus: product.Obsolete ? "Obsolete" : undefined,
    datasheetUrl: httpUrl(product.PrimaryDatasheet),
    sourceProductId: product.DigiKeyProductNumber,
    sourceUrl: httpUrl(product.ProductUrl),
    images: httpUrl(product.PrimaryPhoto) ? [httpUrl(product.PrimaryPhoto)!] : undefined,
    specifications: Object.keys(specifications).length ? specifications : undefined,
  };
}
