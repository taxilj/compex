import { apiFetch } from "./client";

export interface BackendCompany {
  id: string;
  name: string;
  gstin: string | null;
  city: string | null;
  address: string | null;
}

export function getMyCompany() {
  return apiFetch<BackendCompany>("/customers/me/company");
}

export function updateMyCompany(
  data: Partial<Pick<BackendCompany, "name" | "gstin" | "city" | "address">>,
) {
  return apiFetch<BackendCompany>("/customers/me/company", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
