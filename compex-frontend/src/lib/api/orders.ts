import { apiFetch, apiFetchPaginated } from "./client";

export type Money = string | number;
export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PurchaseOrderStatus = "DRAFT" | "SENT" | "ACKNOWLEDGED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type ShipmentStatus = "PROCESSING" | "IN_TRANSIT" | "CUSTOMS" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

export interface SalesOrderItem {
  id: string;
  lineNumber: number;
  mpn: string;
  manufacturer: string | null;
  description: string | null;
  quantity: number;
  unitPrice: Money;
  taxRate: Money;
  taxAmount: Money;
  lineTotal: Money;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  quotationId: string;
  rfqId: string;
  customerId: string;
  status: SalesOrderStatus;
  currency: string;
  subtotal: Money;
  tax: Money;
  total: Money;
  deliveryAddress: string | null;
  notes: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; accountNumber: string; company: { name: string } };
  quotation?: { id?: string; quotationNumber: string };
  items: SalesOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  lineNumber: number;
  mpn: string;
  quantity: number;
  unitCost: Money;
  lineTotal: Money;
  salesOrderItemId: string | null;
  vendorQuoteId: string | null;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  salesOrderId: string;
  vendorId: string;
  status: PurchaseOrderStatus;
  currency: string;
  subtotal: Money;
  total: Money;
  expectedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vendor?: { id: string; name: string; contactEmail: string };
  salesOrder?: { id: string; orderNumber: string; customer: { company: { name: string } } };
  items: PurchaseOrderItem[];
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  salesOrderId: string;
  purchaseOrderId: string | null;
  status: ShipmentStatus;
  trackingNumber: string | null;
  carrier: string | null;
  origin: string | null;
  destination: string | null;
  eta: string | null;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  salesOrder?: { orderNumber: string; customerId?: string };
}

export interface InvoiceItem {
  id: string;
  lineNumber: number;
  mpn: string;
  description: string | null;
  quantity: number;
  unitPrice: Money;
  taxRate: Money;
  taxAmount: Money;
  lineTotal: Money;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  salesOrderId: string;
  customerId: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: Money;
  tax: Money;
  total: Money;
  dueDate: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  salesOrder?: { orderNumber: string };
  customer?: { company: { name: string } };
  items: InvoiceItem[];
}

function query(params?: { status?: string; page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  const value = q.toString();
  return value ? `?${value}` : "";
}

export function listAdminSalesOrders(params?: { status?: SalesOrderStatus; page?: number; limit?: number }) {
  return apiFetchPaginated<SalesOrder>(`/admin/orders${query(params)}`);
}

export function getAdminSalesOrder(id: string) {
  return apiFetch<SalesOrder>(`/admin/orders/${id}`);
}

export function listAdminPurchaseOrders(params?: { status?: PurchaseOrderStatus; page?: number; limit?: number }) {
  return apiFetchPaginated<PurchaseOrder>(`/admin/purchase-orders${query(params)}`);
}

export function createAdminPurchaseOrder(salesOrderId: string, data: { vendorId: string; currency?: string; expectedDate?: string; notes?: string; items: { salesOrderItemId: string; vendorQuoteId?: string; quantity?: number; unitCost: number }[] }) {
  return apiFetch<PurchaseOrder>(`/admin/purchase-orders/from-sales-order/${salesOrderId}`, { method: "POST", body: JSON.stringify(data) });
}

export function updateAdminPurchaseOrderStatus(id: string, status: PurchaseOrderStatus) {
  return apiFetch<PurchaseOrder>(`/admin/purchase-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function listAdminShipments(params?: { status?: ShipmentStatus; page?: number; limit?: number }) {
  return apiFetchPaginated<Shipment>(`/admin/shipments${query(params)}`);
}

export function createAdminShipment(salesOrderId: string, data: { purchaseOrderId?: string; trackingNumber?: string; carrier?: string; origin?: string; destination?: string; eta?: string; notes?: string }) {
  return apiFetch<Shipment>(`/admin/shipments/from-sales-order/${salesOrderId}`, { method: "POST", body: JSON.stringify(data) });
}

export function updateAdminShipmentStatus(id: string, status: ShipmentStatus) {
  return apiFetch<Shipment>(`/admin/shipments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function listAdminInvoices(params?: { status?: InvoiceStatus; page?: number; limit?: number }) {
  return apiFetchPaginated<Invoice>(`/admin/invoices${query(params)}`);
}

export function createAdminInvoice(salesOrderId: string, data?: { dueDate?: string; notes?: string }) {
  return apiFetch<Invoice>(`/admin/invoices/from-sales-order/${salesOrderId}`, { method: "POST", body: JSON.stringify(data ?? {}) });
}

export function updateAdminInvoiceStatus(id: string, status: InvoiceStatus) {
  return apiFetch<Invoice>(`/admin/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function listCustomerOrders(params?: { status?: SalesOrderStatus; page?: number; limit?: number }) {
  return apiFetchPaginated<SalesOrder>(`/orders${query(params)}`);
}

export function getCustomerOrder(id: string) {
  return apiFetch<SalesOrder>(`/orders/${id}`);
}

export function listCustomerShipments(params?: { status?: ShipmentStatus; page?: number; limit?: number }) {
  return apiFetchPaginated<Shipment>(`/shipments${query(params)}`);
}

export function getCustomerShipment(id: string) {
  return apiFetch<Shipment>(`/shipments/${id}`);
}

export function listCustomerInvoices(params?: { status?: InvoiceStatus; page?: number; limit?: number }) {
  return apiFetchPaginated<Invoice>(`/invoices${query(params)}`);
}

export function getCustomerInvoice(id: string) {
  return apiFetch<Invoice>(`/invoices/${id}`);
}
