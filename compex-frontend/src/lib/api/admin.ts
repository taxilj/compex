import { apiFetch } from "./client";
import type { RfqStatus, RfqPriority, BackendRfqItem } from "./rfqs";

export interface AdminRfq {
  id: string;
  rfqNumber: string;
  status: RfqStatus;
  priority: RfqPriority;
  deliveryLocation: string | null;
  requiredDate: string | null;
  additionalNotes: string | null;
  internalNotes: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    accountNumber: string;
    company: { id: string; name: string };
    user: { email: string; firstName: string; lastName: string };
  };
  items?: BackendRfqItem[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Vendor {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listAdminRfqs(params?: { status?: RfqStatus; priority?: RfqPriority; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.priority) q.set("priority", params.priority);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<PaginatedResponse<AdminRfq>>(`/admin/rfqs${qs ? `?${qs}` : ""}`);
}

export function getAdminRfq(id: string) {
  return apiFetch<AdminRfq & { items: BackendRfqItem[]; documents: unknown[] }>(`/admin/rfqs/${id}`);
}

export function updateAdminRfqStatus(id: string, status: RfqStatus, internalNotes?: string) {
  return apiFetch<AdminRfq>(`/admin/rfqs/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, internalNotes }),
  });
}

export function listVendors() {
  return apiFetch<PaginatedResponse<Vendor>>("/admin/vendors");
}

export function createVendor(data: { name: string; contactEmail: string; contactPhone?: string; address?: string; notes?: string }) {
  return apiFetch<Vendor>("/admin/vendors", { method: "POST", body: JSON.stringify(data) });
}

export function listManufacturers() {
  return apiFetch<PaginatedResponse<Manufacturer>>("/admin/manufacturers");
}

export function createManufacturer(data: { name: string; slug: string; logoUrl?: string; website?: string }) {
  return apiFetch<Manufacturer>("/admin/manufacturers", { method: "POST", body: JSON.stringify(data) });
}

export interface AdminQuotation {
  id: string;
  quotationNumber: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  validUntil: string;
  notes: string | null;
  deliveryTerms: string | null;
  paymentTerms: string | null;
  sentAt: string | null;
  createdAt: string;
  customer: {
    id: string;
    accountNumber: string;
    user: { firstName: string; lastName: string; email: string };
    company: { name: string };
  };
  rfq: { id: string; rfqNumber: string };
  items: { id: string }[];
}

export function listAdminQuotations(params?: { status?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<PaginatedResponse<AdminQuotation>>(`/admin/quotations${qs ? `?${qs}` : ""}`);
}

export interface AdminLead {
  id: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  companyName: string;
  source: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "QUOTATION" | "WON" | "LOST";
  priority: "LOW" | "MEDIUM" | "HIGH";
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  createdAt: string;
  rfq: { id: string; rfqNumber: string; status: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string; email: string } | null;
}

export function listAdminLeads(params?: { status?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<PaginatedResponse<AdminLead>>(`/admin/leads${qs ? `?${qs}` : ""}`);
}
