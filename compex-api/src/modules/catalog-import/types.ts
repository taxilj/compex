// A single raw record from any catalog source, before validation/normalization.
export interface RawCatalogItem {
  mpn: string;
  manufacturer?: string;
  name?: string;
  description?: string;
  category?: string;
  packageType?: string;
  mountingType?: string;
  lifecycleStatus?: string;
  datasheetUrl?: string;
  sourceProductId?: string;
  // Added for live-source adapters (Mouser et al.) — the CSV fetcher simply
  // never sets these, so it is unaffected.
  sourceUrl?: string;
  images?: string[];
  specifications?: Record<string, unknown>;
  // Internal-sourcing-only data (seller, price, stock, MOQ, lead time, offer
  // URL) from a live source that provides it, e.g. Nexar Supply. Stored only
  // on ProductSource.internalOffers -- normalizer.ts/upsert.ts never let
  // this reach the Product model, which is what the public API reads. Left
  // undefined by every other fetcher (Mouser/element14/DigiKey/CSV never
  // capture commercial data at all).
  internalOffers?: unknown[];
}

export interface FetchPage {
  items: RawCatalogItem[];
  // Present when more pages remain; undefined/omitted signals the last page.
  // Persisted on CatalogImportRun.cursor after each page so a failed run can
  // resume instead of restarting from the beginning.
  nextCursor?: string;
}

// Any catalog source (manual file, a future authorized distributor/manufacturer
// API) implements this. No live source is wired up in this pass — see
// fetchers/csv-fetcher.ts for the one shipped adapter (admin-uploaded file).
export interface CatalogFetcher {
  source: string;
  fetch(cursor?: string): Promise<FetchPage>;
}
