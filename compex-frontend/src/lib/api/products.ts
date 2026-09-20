import { ApiError, apiFetch, apiFetchPaginated, apiFetchPublic } from "./client";

export interface BackendManufacturer {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  country: string | null;
}

export interface BackendCategory {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
}

export interface BackendProduct {
  id: string;
  mpn: string;
  name: string | null;
  description: string | null;
  specifications: Record<string, unknown> | null;
  packageType: string | null;
  mountingType: string | null;
  lifecycleStatus: string | null;
  datasheetUrl: string | null;
  images: string[];
  manufacturer: BackendManufacturer | null;
  category: BackendCategory | null;
}

export interface PublicProduct {
  mpn: string;
  manufacturer: string;
  productName: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  datasheetUrl?: string;
  lifecycleStatus?: string;
  compliance?: string[];
  specifications: Array<{ name: string; value: string }>;
}

export type ProviderName = "MOUSER" | "DIGIKEY" | "ELEMENT14";
export type ProviderResultStatus = "FOUND" | "NO_MATCH" | "ERROR" | "TIMEOUT" | "RATE_LIMITED";

export interface ProviderStatusEntry {
  provider: ProviderName;
  status: ProviderResultStatus;
}

export interface MpnSearchResult {
  product: PublicProduct | null;
  sources: ProviderStatusEntry[];
}

export interface ProductListParams {
  q?: string;
  categoryId?: string;
  manufacturerId?: string;
  packageType?: string;
  lifecycleStatus?: string;
  page?: number;
  limit?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") q.set(key, String(value));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

// One bounded retry for idempotent public reads: a network failure or 5xx
// (typically a cold-starting backend) gets a second attempt. Timeouts, caller
// aborts and 4xx are never retried -- a timeout already spent its full budget,
// and retrying it would double the time before the user sees an error.
async function retryRead<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const retryable = (err instanceof ApiError && err.statusCode >= 500) || err instanceof TypeError;
    if (!retryable) throw err;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return run();
  }
}

export function listProducts(params?: ProductListParams, signal?: AbortSignal) {
  return retryRead(() => apiFetchPaginated<BackendProduct>(`/products${buildQuery({ ...params })}`, { signal }));
}

export function getProduct(mpn: string, manufacturerId?: string) {
  return apiFetch<BackendProduct>(`/products/${encodeURIComponent(mpn)}${buildQuery({ manufacturerId })}`);
}

export function lookupPublicProduct(mpn: string) {
  return apiFetchPublic<MpnSearchResult>(`/api/products/lookup${buildQuery({ mpn })}`);
}

export interface OnDemandProviderEntry {
  provider: ProviderName;
  status: ProviderResultStatus;
}

export interface OnDemandResolveResult {
  product: BackendProduct | null;
  sources: OnDemandProviderEntry[];
}

// Controlled on-demand lookup for an MPN that a database-first getProduct()
// call just reported as not found. Only call this after a real 404 from
// getProduct() -- never unconditionally -- since it can trigger live
// provider calls and writes to the shared catalog.
export function resolveProduct(mpn: string, manufacturerId?: string) {
  return apiFetch<OnDemandResolveResult>(`/products/${encodeURIComponent(mpn)}/resolve${buildQuery({ manufacturerId })}`, {
    method: "POST",
  });
}

export interface CategoryWithChildren extends BackendCategory {
  children: CategoryWithChildren[];
  _count: { products: number };
}

// Category tree cache (stale-while-revalidate): the tree changes rarely and is
// read by the header, home page, products filter and categories page, so one
// shared in-flight request serves them all and the last good copy can be
// painted instantly while a refresh runs.
const CATEGORY_FRESH_MS = 30_000;
let categoryCache: { data: CategoryWithChildren[]; at: number } | null = null;
let categoryInflight: Promise<CategoryWithChildren[]> | null = null;

export function peekCategories(): CategoryWithChildren[] | null {
  return categoryCache?.data ?? null;
}

export function listCategories(options?: { force?: boolean }): Promise<CategoryWithChildren[]> {
  if (!options?.force && categoryCache && Date.now() - categoryCache.at < CATEGORY_FRESH_MS) {
    return Promise.resolve(categoryCache.data);
  }
  categoryInflight ??= retryRead(() => apiFetch<CategoryWithChildren[]>("/categories"))
    .then((data) => {
      categoryCache = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      categoryInflight = null;
    });
  return categoryInflight;
}

export function resetCategoryCache(): void {
  categoryCache = null;
  categoryInflight = null;
}
