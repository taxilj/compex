import { apiFetch, apiFetchPaginated } from "./client";
import type { RfqStatus, RfqPriority, BackendRfqItem } from "./rfqs";

export type SourcingStatus =
  | "NEW"
  | "REVIEWING"
  | "SOURCING"
  | "SUPPLIER_QUOTES_PENDING"
  | "SUPPLIER_QUOTES_RECEIVED"
  | "COMPARE"
  | "CUSTOMER_QUOTE_READY"
  | "QUOTE_SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "ORDER_PROCUREMENT";

export interface AdminRfq {
  id: string;
  rfqNumber: string;
  status: RfqStatus;
  sourcingStatus: SourcingStatus | null;
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

export interface ContactEntry {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  contactName: string | null;
  vendorCode: string | null;
  billToAddress: string | null;
  shipToAddress: string | null;
  country: string | null;
  telephone: string | null;
  fax: string | null;
  mobile: string | null;
  website: string | null;
  otherOffices: string | null;
  mov: string | null;
  paymentCurrency: string | null;
  paymentTerms: string | null;
  shippingAccount: string | null;
  bankDetails: string | null;
  creditLimit: string | null;
  industrySegment: string | null;
  businessType: string | null;
  speciality: string | null;
  gstOrRegistrationNumber: string | null;
  contacts: ContactEntry[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VendorInput = Partial<Omit<Vendor, "id" | "createdAt" | "updatedAt" | "isActive" | "mov" | "creditLimit">> & {
  name: string;
  contactEmail: string;
  mov?: number;
  creditLimit?: number;
};

export interface Manufacturer {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  country: string | null;
  source: string;
  sourceUrl: string | null;
  distributorLink: string | null;
  stockCheckLink: string | null;
  acquiredMfr: string | null;
  remarks: string | null;
  suffixInformation: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ManufacturerInput = Partial<Omit<Manufacturer, "id" | "createdAt" | "updatedAt" | "isActive">> & {
  name: string;
  slug: string;
};

export interface AdminCategory {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
}

export interface AdminProduct {
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
  isActive: boolean;
  source: string;
  importStatus: string;
  lastImportedAt: string | null;
  manufacturerId: string | null;
  categoryId: string | null;
  manufacturer: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  productCode: string | null;
  spq: number | null;
  packaging: string | null;
  uom: string | null;
  hsCode: string | null;
  hsDescription: string | null;
  productGroup: string | null;
  eccn: string | null;
  availableStock: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductInput {
  mpn: string;
  name?: string;
  description?: string;
  manufacturerId?: string;
  categoryId?: string;
  specifications?: Record<string, unknown>;
  packageType?: string;
  mountingType?: string;
  lifecycleStatus?: string;
  datasheetUrl?: string;
  images?: string[];
  isActive?: boolean;
  productCode?: string;
  spq?: number;
  packaging?: string;
  uom?: string;
  hsCode?: string;
  hsDescription?: string;
  productGroup?: string;
  eccn?: string;
  availableStock?: number;
}

export interface ProductHistory {
  rfqRequests: Array<{ id: string; quantity: number; targetPriceUsd: string | null; status: string; requiredDate: string | null; createdAt: string; rfq: { rfqNumber: string; status: string } }>;
  sales: Array<{ id: string; quantity: number; unitPrice: string; lineTotal: string; createdAt: string; quotation: { quotationNumber: string; status: string; currency: string } }>;
  purchases: Array<{ id: string; vendorId: string; vendorName: string; unitCost: string; currency: string; leadTimeDays: number | null; moq: number | null; status: string; createdAt: string }>;
}

export function getProductHistory(id: string) {
  return apiFetch<ProductHistory>(`/admin/products/${id}/history`);
}

export interface CatalogImportRun {
  id: string;
  source: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  cursor: string | null;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsFailed: number;
  errorLog: unknown;
  startedAt: string;
  completedAt: string | null;
}

export interface AdminCustomerCompany {
  id: string;
  name: string;
  gstin: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  shortName: string | null;
  billToAddress: string | null;
  shipToAddress: string | null;
  additionalShipToAddresses: string[] | null;
  state: string | null;
  country: string | null;
  relationshipType: string | null;
  customerType: string | null;
  website: string | null;
  fax: string | null;
  primaryContact: string | null;
  contactEmail: string | null;
  authorisedPerson: string | null;
  paymentTerms: string | null;
  creditLimit: string | null;
  region: string | null;
  internalAccountNumber: string | null;
  shippingAccount: string | null;
  bankDetails: string | null;
  industrySegment: string | null;
  remarks: string | null;
  contacts: ContactEntry[] | null;
  salesPerson: { id: string; firstName: string; lastName: string } | null;
  salesCoordinator: { id: string; firstName: string; lastName: string } | null;
  sourcingOwner: { id: string; firstName: string; lastName: string } | null;
}

export interface AdminCustomer {
  id: string;
  accountNumber: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" };
  company: AdminCustomerCompany;
  _count: { rfqs: number; quotations: number };
}

export interface AdminCustomerInput {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyPhone?: string;
  gstin?: string;
  city?: string;
  address?: string;
  shortName?: string;
  billToAddress?: string;
  shipToAddress?: string;
  additionalShipToAddresses?: string[];
  state?: string;
  country?: string;
  relationshipType?: string;
  customerType?: string;
  website?: string;
  fax?: string;
  primaryContact?: string;
  contactEmail?: string;
  authorisedPerson?: string;
  paymentTerms?: string;
  creditLimit?: number;
  region?: string;
  salesPersonId?: string | null;
  salesCoordinatorId?: string | null;
  sourcingOwnerId?: string | null;
  internalAccountNumber?: string;
  shippingAccount?: string;
  bankDetails?: string;
  industrySegment?: string;
  remarks?: string;
  contacts?: ContactEntry[];
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

export function listVendors(params?: { search?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetchPaginated<Vendor>(`/admin/vendors${qs ? `?${qs}` : ""}`);
}

export function createVendor(data: VendorInput) {
  return apiFetch<Vendor>("/admin/vendors", { method: "POST", body: JSON.stringify(data) });
}

export function updateVendor(id: string, data: Partial<VendorInput>) {
  return apiFetch<Vendor>(`/admin/vendors/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deactivateVendor(id: string) {
  return apiFetch<Vendor>(`/admin/vendors/${id}/deactivate`, { method: "POST" });
}

export function activateVendor(id: string) {
  return apiFetch<Vendor>(`/admin/vendors/${id}/activate`, { method: "POST" });
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

export function listManufacturers(params?: { search?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetchPaginated<Manufacturer>(`/admin/manufacturers${qs ? `?${qs}` : ""}`);
}

export function createManufacturer(data: ManufacturerInput) {
  return apiFetch<Manufacturer>("/admin/manufacturers", { method: "POST", body: JSON.stringify(data) });
}

export function updateManufacturer(id: string, data: Partial<ManufacturerInput>) {
  return apiFetch<Manufacturer>(`/admin/manufacturers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deactivateManufacturer(id: string) {
  return apiFetch<Manufacturer>(`/admin/manufacturers/${id}/deactivate`, { method: "POST" });
}

export function activateManufacturer(id: string) {
  return apiFetch<Manufacturer>(`/admin/manufacturers/${id}/activate`, { method: "POST" });
}

export function listAdminCategories() {
  return apiFetch<AdminCategory[]>("/admin/categories");
}

export function createCategory(data: { name: string; description?: string; parentId?: string }) {
  return apiFetch<AdminCategory>("/admin/categories", { method: "POST", body: JSON.stringify(data) });
}

export function updateCategory(id: string, data: Partial<{ name: string; description: string; parentId: string }>) {
  return apiFetch<AdminCategory>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function listAdminProducts(params?: { q?: string; categoryId?: string; manufacturerId?: string; importStatus?: string; isActive?: boolean; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") q.set(key, String(value));
  }
  const qs = q.toString();
  return apiFetchPaginated<AdminProduct>(`/admin/products${qs ? `?${qs}` : ""}`);
}

export function createProduct(data: AdminProductInput) {
  return apiFetch<AdminProduct>("/admin/products", { method: "POST", body: JSON.stringify(data) });
}

export function updateProduct(id: string, data: Partial<AdminProductInput>) {
  return apiFetch<AdminProduct>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function uploadCatalogCsv(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<CatalogImportRun>("/admin/catalog-import/csv", { method: "POST", body: form });
}

export function importFromMouser(mpn: string) {
  return apiFetch<{ run: CatalogImportRun; product: AdminProduct | null }>(`/admin/catalog-import/mouser/${encodeURIComponent(mpn)}`, { method: "POST" });
}

export function updateAdminRfqSourcingStatus(id: string, sourcingStatus: SourcingStatus) {
  return apiFetch<AdminRfq>(`/admin/rfqs/${id}/sourcing-status`, {
    method: "PATCH",
    body: JSON.stringify({ sourcingStatus }),
  });
}

export function importFromElement14(mpn: string) {
  return apiFetch<{ run: CatalogImportRun; product: AdminProduct | null }>(`/admin/catalog-import/element14/${encodeURIComponent(mpn)}`, { method: "POST" });
}

export function importFromDigiKey(mpn: string) {
  return apiFetch<{ run: CatalogImportRun; product: AdminProduct | null }>(`/admin/catalog-import/digikey/${encodeURIComponent(mpn)}`, { method: "POST" });
}

export function listCatalogImportRuns(params?: { page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetchPaginated<CatalogImportRun>(`/admin/catalog-import/runs${qs ? `?${qs}` : ""}`);
}

export interface CatalogCoverage {
  totals: { products: number; manufacturers: number; categories: number };
  dataQuality: {
    productsMissingCategory: number;
    productsMissingManufacturer: number;
    productsMissingImage: number;
    productsWithImage: number;
    productsMissingDatasheet: number;
    productsWithDatasheet: number;
  };
  byManufacturer: Array<{ id: string; name: string; productCount: number }>;
  byCategory: Array<{ id: string; name: string; productCount: number }>;
  productSourceCoverage: Array<{ source: string; count: number }>;
  lastImportRun: Pick<CatalogImportRun, "source" | "status" | "startedAt" | "completedAt" | "itemsProcessed" | "itemsCreated" | "itemsUpdated" | "itemsFailed"> | null;
  recentImportErrors: Array<Pick<CatalogImportRun, "source" | "status" | "startedAt" | "itemsFailed" | "errorLog">>;
}

export function getCatalogCoverage() {
  return apiFetch<CatalogCoverage>("/admin/catalog-import/coverage");
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

export function convertLeadToRfq(leadId: string, customerId: string) {
  return apiFetch<{ lead: AdminLead; rfq: AdminRfq & { items: BackendRfqItem[] } }>(`/admin/leads/${leadId}/convert-to-rfq`, {
    method: "POST",
    body: JSON.stringify({ customerId }),
  });
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Dropdown consumers (SettingsSelect) call this with no options and get only
// active values. The Settings management page passes includeInactive so an
// admin can see and reactivate retired values.
export function listSettings(category?: string, options?: { includeInactive?: boolean }) {
  const q = new URLSearchParams();
  if (category) q.set("category", category);
  if (options?.includeInactive) q.set("includeInactive", "true");
  const qs = q.toString();
  return apiFetch<Setting[]>(`/admin/settings${qs ? `?${qs}` : ""}`);
}

export function listSettingCategories() {
  return apiFetch<string[]>("/admin/settings/categories");
}

export function createSetting(data: { category: string; value: string; sortOrder?: number; isActive?: boolean }) {
  return apiFetch<Setting>("/admin/settings", { method: "POST", body: JSON.stringify(data) });
}

export function updateSetting(id: string, data: { value?: string; sortOrder?: number; isActive?: boolean }) {
  return apiFetch<Setting>(`/admin/settings/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteSetting(id: string) {
  await apiFetch<void>(`/admin/settings/${id}`, { method: "DELETE" });
}

export function deactivateSetting(id: string) {
  return apiFetch<Setting>(`/admin/settings/${id}/deactivate`, { method: "POST" });
}

export function activateSetting(id: string) {
  return apiFetch<Setting>(`/admin/settings/${id}/activate`, { method: "POST" });
}

export type UserRoleValue = "CUSTOMER" | "STAFF" | "ADMIN";
export type UserStatusValue = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";

export interface AdminUser {
  id: string;
  email: string;
  role: UserRoleValue;
  status: UserStatusValue;
  firstName: string;
  lastName: string;
  screenName: string | null;
  organizationId: string | null;
  position: string | null;
  department: string | null;
  mobile: string | null;
  phone: string | null;
  address: string | null;
  skype: string | null;
  createdAt: string;
  updatedAt: string;
  organization: { id: string; companyName: string; shortName: string } | null;
}

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role?: UserRoleValue;
  screenName?: string;
  organizationId?: string | null;
  position?: string;
  department?: string;
  mobile?: string;
  phone?: string;
  address?: string;
  skype?: string;
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, "role">> & { status?: "ACTIVE" | "SUSPENDED" };

export function listUsers(params?: { search?: string; role?: UserRoleValue; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.role) q.set("role", params.role);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetchPaginated<AdminUser>(`/admin/users${qs ? `?${qs}` : ""}`);
}

export function getUser(id: string) {
  return apiFetch<AdminUser>(`/admin/users/${id}`);
}

export function createUser(data: CreateUserInput) {
  return apiFetch<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(data) });
}

export function updateUser(id: string, data: UpdateUserInput) {
  return apiFetch<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}
