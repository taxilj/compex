import { apiFetch, apiFetchPaginated } from "./client";
import type { BackendManufacturer, BackendProduct } from "./products";

export interface ManufacturerListItem extends BackendManufacturer {
  _count: { products: number };
}

export function listManufacturers(params?: { page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetchPaginated<ManufacturerListItem>(`/manufacturers${qs ? `?${qs}` : ""}`);
}

export function getManufacturer(slug: string, params?: { page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<{
    manufacturer: BackendManufacturer;
    products: { data: BackendProduct[]; meta: { total: number; page: number; limit: number } };
  }>(`/manufacturers/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`);
}
