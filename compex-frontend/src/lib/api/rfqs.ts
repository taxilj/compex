import { apiFetch } from "./client";

export type RfqStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "SOURCING" | "CANCELLED";
export type RfqPriority = "LOW" | "MEDIUM" | "HIGH";

export interface BackendRfqItem {
  id: string;
  rfqId: string;
  lineNumber: number;
  mpn: string;
  manufacturer: string | null;
  description: string | null;
  quantity: number;
  targetPriceUsd: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendRfq {
  id: string;
  rfqNumber: string;
  status: RfqStatus;
  priority: RfqPriority;
  deliveryLocation: string | null;
  requiredDate: string | null;
  additionalNotes: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerId: string;
  items?: BackendRfqItem[];
  _count?: { items: number };
}

export function listRfqs(params?: { status?: RfqStatus; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<BackendRfq[]>(`/rfqs${qs ? `?${qs}` : ""}`);
}

export function getRfq(id: string) {
  return apiFetch<BackendRfq & { items: BackendRfqItem[] }>(`/rfqs/${id}`);
}

export function createRfq(data: {
  deliveryLocation?: string;
  requiredDate?: string;
  priority?: RfqPriority;
  additionalNotes?: string;
}) {
  return apiFetch<BackendRfq>("/rfqs", { method: "POST", body: JSON.stringify(data) });
}

export function addRfqItem(
  rfqId: string,
  data: {
    mpn: string;
    manufacturer?: string;
    description?: string;
    quantity: number;
    targetPriceUsd?: number;
    notes?: string;
  },
) {
  return apiFetch<BackendRfqItem>(`/rfqs/${rfqId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function submitRfq(rfqId: string) {
  return apiFetch<BackendRfq>(`/rfqs/${rfqId}/submit`, { method: "POST" });
}

export function uploadBom(rfqId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<{ jobId: string; message: string }>(`/rfqs/${rfqId}/bom`, {
    method: "POST",
    body: form,
  });
}
