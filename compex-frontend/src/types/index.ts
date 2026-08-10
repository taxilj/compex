// Core domain types for Compex Solution

export type Status =
  | "draft"
  | "submitted"
  | "under_review"
  | "sourcing"
  | "quote_ready"
  | "quote_sent"
  | "accepted"
  | "rejected"
  | "processing"
  | "procurement"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "paid"
  | "pending"
  | "overdue"
  | "closed_won"
  | "closed_lost";

export interface Manufacturer {
  id: string;
  name: string;
  shortName: string;
  country: string;
  logoUrl?: string;
  categories: string[];
}

export interface Product {
  id: string;
  mpn: string;
  manufacturerId: string;
  manufacturer: string;
  description: string;
  category: string;
  package: string;
  rohs: boolean;
  reach: boolean;
  datasheet?: string;
  moq: number;
  leadTimeDays: number;
  availability: "available" | "on_request" | "limited";
  specs: Record<string, string>;
}

export interface RFQItem {
  id: string;
  mpn: string;
  manufacturer?: string;
  description?: string;
  quantity: number;
  targetPrice?: number;
  notes?: string;
}

export interface RFQ {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  status: Status;
  items: RFQItem[];
  deliveryCity: string;
  requiredDate: string;
  additionalNotes?: string;
  assignedTo?: string;
  estimatedValue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItem {
  id: string;
  mpn: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  leadTime: string;
  availability: string;
}

export interface Quote {
  id: string;
  number: string;
  rfqId: string;
  rfqNumber: string;
  customerId: string;
  customerName: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  items: QuoteItem[];
  subtotal: number;
  shippingCost: number;
  gstAmount: number;
  grandTotal: number;
  validUntil: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  mpn: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  number: string;
  quoteId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  status: Status;
  items: OrderItem[];
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  paymentStatus: "paid" | "pending" | "partial";
  deliveryAddress: string;
  estimatedDelivery: string;
  createdAt: string;
}

export interface ShipmentEvent {
  date: string;
  location: string;
  description: string;
  completed: boolean;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  orderId: string;
  orderNumber: string;
  carrier: string;
  origin: string;
  destination: string;
  eta: string;
  status: "processing" | "in_transit" | "customs" | "out_for_delivery" | "delivered";
  events: ShipmentEvent[];
  documents: { name: string; type: string }[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  totalPrice: number;
}

export interface Invoice {
  id: string;
  number: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: "paid" | "pending" | "overdue";
  items: InvoiceItem[];
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  invoiceDate: string;
  dueDate: string;
  paidDate?: string;
}

export interface Company {
  id: string;
  name: string;
  gstin: string;
  pan?: string;
  contactPerson: string;
  email: string;
  phone: string;
  website?: string;
  tier: "standard" | "enterprise";
  billingAddress: Address;
  shippingAddress: Address;
  users: CompanyUser[];
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "buyer" | "viewer";
  initials: string;
}

export interface Task {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  relatedTo?: string;
  completed: boolean;
}

export interface TimelineStep {
  label: string;
  date?: string;
  completed: boolean;
  current?: boolean;
}
