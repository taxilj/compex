import { ApiError, apiFetch, apiFetchPaginated } from "./client";
import type { BackendManufacturer, BackendProduct } from "./products";

export interface ManufacturerListItem extends BackendManufacturer {
  _count: { products: number };
}

// Identical concurrent requests (header menu + marquee + StrictMode's double
// effect) share one network call; the entry is dropped once it settles.
const manufacturerInflight = new Map<string, ReturnType<typeof apiFetchPaginated<ManufacturerListItem>>>();

export function listManufacturers(params?: { page?: number; limit?: number; q?: string }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.q?.trim()) q.set("q", params.q.trim());
  const qs = q.toString();
  const path = `/manufacturers${qs ? `?${qs}` : ""}`;
  const pending = manufacturerInflight.get(path);
  if (pending) return pending;
  // Two five-second attempts bound directory recovery to ten seconds.
  const request = apiFetchPaginated<ManufacturerListItem>(path, undefined, 5_000)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.code === "TIMEOUT") return apiFetchPaginated<ManufacturerListItem>(path, undefined, 5_000);
      throw error;
    })
    .finally(() => manufacturerInflight.delete(path));
  manufacturerInflight.set(path, request);
  return request;
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
