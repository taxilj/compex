import { apiFetch, apiFetchPaginated } from "./client";
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
  _count?: { items: number };
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

export interface AdminCustomer {
  id: string;
  accountNumber: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" };
  company: { id: string; name: string; gstin: string | null; city: string | null; address: string | null };
  _count: { rfqs: number; quotations: number };
}

export interface AdminCustomerInput {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gstin?: string;
  city?: string;
  address?: string;
}

export function listCustomers(params?: { q?: string; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString();
  return apiFetchPaginated<AdminCustomer>(`/admin/customers${suffix ? `?${suffix}` : ""}`);
}

export function getCustomer(id: string) {
  return apiFetch<AdminCustomer>(`/admin/customers/${id}`);
}

export function createCustomer(data: AdminCustomerInput) {
  return apiFetch<AdminCustomer>("/admin/customers", { method: "POST", body: JSON.stringify(data) });
}

export function updateCustomer(id: string, data: Partial<AdminCustomerInput>) {
  return apiFetch<AdminCustomer>(`/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function listAdminRfqs(params?: { status?: RfqStatus; priority?: RfqPriority; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.priority) q.set("priority", params.priority);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetchPaginated<AdminRfq>(`/admin/rfqs${qs ? `?${qs}` : ""}`);
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
  return apiFetchPaginated<Vendor>("/admin/vendors");
}

export function createVendor(data: { name: string; contactEmail: string; contactPhone?: string; address?: string; notes?: string }) {
  return apiFetch<Vendor>("/admin/vendors", { method: "POST", body: JSON.stringify(data) });
}

export type VendorRfqStatus = "DRAFT" | "SENT" | "REPLIED" | "CLOSED";
export type VendorQuoteStatus = "RECEIVED" | "SELECTED" | "REJECTED";

export interface AdminVendorQuote {
  id: string;
  rfqItemId: string;
  status: VendorQuoteStatus;
  unitCost: string;
  currency: string;
  leadTimeDays: number | null;
  moq: number | null;
  notes: string | null;
}

export interface AdminVendorRfq {
  id: string;
  vendorRfqNumber: string;
  rfqId: string;
  vendorId: string;
  status: VendorRfqStatus;
  emailSentAt: string | null;
  notes: string | null;
  createdAt: string;
  vendor: Pick<Vendor, "id" | "name" | "contactEmail">;
  items: { id: string; rfqItemId: string; quantity: number; notes: string | null }[];
  quotes: AdminVendorQuote[];
}

export function listVendorRfqs(params?: { rfqId?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.rfqId) q.set("rfqId", params.rfqId);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetchPaginated<AdminVendorRfq>(`/admin/vendor-rfqs${qs ? `?${qs}` : ""}`);
}

export function createVendorRfq(data: { rfqId: string; vendorId: string; itemIds: string[]; notes?: string }) {
  return apiFetch<AdminVendorRfq>("/admin/vendor-rfqs", { method: "POST", body: JSON.stringify(data) });
}

export function sendVendorRfq(id: string) {
  return apiFetch<AdminVendorRfq>(`/admin/vendor-rfqs/${id}/send`, { method: "POST" });
}

export function recordVendorQuote(id: string, data: { rfqItemId: string; unitCost: number; currency?: string; leadTimeDays?: number; moq?: number; notes?: string }) {
  return apiFetch<AdminVendorQuote>(`/admin/vendor-rfqs/${id}/quotes`, { method: "POST", body: JSON.stringify(data) });
}

export function selectVendorQuote(vendorRfqId: string, quoteId: string, status: "SELECTED" | "REJECTED") {
  return apiFetch<AdminVendorQuote>(`/admin/vendor-rfqs/${vendorRfqId}/quotes/${quoteId}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function listManufacturers() {
  return apiFetchPaginated<Manufacturer>("/admin/manufacturers");
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
  return apiFetchPaginated<AdminQuotation>(`/admin/quotations${qs ? `?${qs}` : ""}`);
}

export function createQuotationFromSourcing(rfqId: string, data: { marginPercent: number; taxRate?: number; validUntil: string; notes?: string }) {
  return apiFetch<AdminQuotation>(`/admin/quotations/from-sourcing/${rfqId}`, { method: "POST", body: JSON.stringify(data) });
}

export function sendAdminQuotation(id: string) {
  return apiFetch<AdminQuotation>(`/admin/quotations/${id}/send`, { method: "POST" });
}

  export interface AdminLead {
    id: string;
    referenceNumber: string | null;
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
    subject: string | null;
    deliveryLocation: string | null;
    requiredDate: string | null;
    notificationStatus: "PENDING" | "SENT" | "FAILED" | null;
    notificationSentAt: string | null;
    notificationError: string | null;
    createdAt: string;
    rfq: { id: string; rfqNumber: string; status: string } | null;
    items: { id: string; lineNumber: number; mpn: string; manufacturer: string | null; description: string | null; quantity: number }[];
  assignedTo: { id: string; firstName: string; lastName: string; email: string } | null;
}

export function listAdminLeads(params?: { status?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetchPaginated<AdminLead>(`/admin/leads${qs ? `?${qs}` : ""}`);
}

export interface Organization {
  id: string;
  companyName: string;
  shortName: string;
  address: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  contactPerson: string | null;
  ffAccount: string | null;
  currency: string;
  companyRegistrationNo: string | null;
  invoicePrefix: string | null;
  proformaInvoicePrefix: string | null;
  packingSlipPrefix: string | null;
  cocPrefix: string | null;
  orderAckPrefix: string | null;
  quotationPrefix: string | null;
  salesOrderPrefix: string | null;
  purchaseOrderPrefix: string | null;
  itemNoPrefix: string | null;
  vendorCodePrefix: string | null;
  customerCodePrefix: string | null;
  contactCodePrefix: string | null;
  location: string | null;
  rmaPrefix: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankAddress: string | null;
  swiftIfscMicr: string | null;
  routingCode: string | null;
  signatureUrl: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationInput = Omit<Organization, "id" | "createdAt" | "updatedAt">;

export function listOrganizations() {
  return apiFetchPaginated<Organization>("/admin/organizations");
}

export function createOrganization(data: Partial<OrganizationInput>) {
  return apiFetch<Organization>("/admin/organizations", { method: "POST", body: JSON.stringify(data) });
}

export function updateOrganization(id: string, data: Partial<OrganizationInput>) {
  return apiFetch<Organization>(`/admin/organizations/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export interface Setting {
  id: string;
  category: string;
  value: string;
  sortOrder: number;
  isEditable: boolean;
  createdAt: string;
  updatedAt: string;
}

export function listSettings(category?: string) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiFetch<Setting[]>(`/admin/settings${qs}`);
}

export function listSettingCategories() {
  return apiFetch<string[]>("/admin/settings/categories");
}

export function createSetting(data: { category: string; value: string; sortOrder?: number }) {
  return apiFetch<Setting>("/admin/settings", { method: "POST", body: JSON.stringify(data) });
}

export function updateSetting(id: string, data: { value?: string; sortOrder?: number }) {
  return apiFetch<Setting>(`/admin/settings/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteSetting(id: string) {
  await apiFetch<void>(`/admin/settings/${id}`, { method: "DELETE" });
}
