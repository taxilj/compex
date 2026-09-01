import { apiFetch, apiFetchPaginated } from "./client";

export interface QuoteItem {
  id: string;
  lineNumber: number;
  mpn: string;
  description: string | null;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
}

export interface CustomerQuote {
  id: string;
  quotationNumber: string;
  status: "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "DRAFT";
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  validUntil: string;
  deliveryTerms: string | null;
  paymentTerms: string | null;
  notes: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  rfq: { id: string; rfqNumber: string };
  items: QuoteItem[];
}

export interface PaginatedQuotes {
  data: CustomerQuote[];
  total: number;
  page: number;
  limit: number;
}

export function listCustomerQuotes(params?: { status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return apiFetchPaginated<CustomerQuote>(`/quotes${q ? `?${q}` : ""}`);
}

export function getCustomerQuote(id: string) {
  return apiFetch<CustomerQuote>(`/quotes/${id}`);
}

export function acceptQuote(id: string) {
  return apiFetch<CustomerQuote>(`/quotes/${id}/accept`, { method: "POST" });
}

export function rejectQuote(id: string, reason: string) {
  return apiFetch<CustomerQuote>(`/quotes/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
