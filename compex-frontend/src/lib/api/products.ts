import { apiFetch, apiFetchPaginated, apiFetchPublic } from "./client";

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
  source: string;
  sourceUrl: string | null;
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

export type ProviderName = "MOUSER" | "DIGIKEY" | "ELEMENT14" | "NEXAR";
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

export function listProducts(params?: ProductListParams) {
  return apiFetchPaginated<BackendProduct>(`/products${buildQuery({ ...params })}`);
}

export function getProduct(mpn: string, manufacturerId?: string) {
  return apiFetch<BackendProduct>(`/products/${encodeURIComponent(mpn)}${buildQuery({ manufacturerId })}`);
}

export function lookupPublicProduct(mpn: string) {
  return apiFetchPublic<MpnSearchResult>(`/api/products/lookup${buildQuery({ mpn })}`);
}

export interface CategoryWithChildren extends BackendCategory {
  children: BackendCategory[];
}

export function listCategories() {
  return apiFetch<CategoryWithChildren[]>("/categories");
}
