export const SOURCING_STATUSES = [
  "NEW",
  "REVIEWING",
  "SOURCING",
  "SUPPLIER_QUOTES_PENDING",
  "SUPPLIER_QUOTES_RECEIVED",
  "COMPARE",
  "CUSTOMER_QUOTE_READY",
  "QUOTE_SENT",
  "ACCEPTED",
  "REJECTED",
  "ORDER_PROCUREMENT",
] as const;

export type SourcingStatus = (typeof SOURCING_STATUSES)[number];

export const NEXT_SOURCING_STATUSES: Record<SourcingStatus, readonly SourcingStatus[]> = {
  NEW: ["REVIEWING"],
  REVIEWING: ["SOURCING"],
  SOURCING: ["SUPPLIER_QUOTES_PENDING"],
  SUPPLIER_QUOTES_PENDING: ["SUPPLIER_QUOTES_RECEIVED"],
  SUPPLIER_QUOTES_RECEIVED: ["COMPARE"],
  COMPARE: ["CUSTOMER_QUOTE_READY"],
  CUSTOMER_QUOTE_READY: ["QUOTE_SENT"],
  QUOTE_SENT: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["ORDER_PROCUREMENT"],
  REJECTED: [],
  ORDER_PROCUREMENT: [],
};

export function allowedNextSourcingStatuses(current: SourcingStatus | null): readonly SourcingStatus[] {
  // Pre-existing RFQs retain their old customer-facing status and are only
  // initialized deliberately by a staff member.
  return current === null ? ["NEW"] : NEXT_SOURCING_STATUSES[current];
}
