import { apiFetch } from "./client";

export type WebsiteEnquirySource = "CONTACT" | "REQUEST_QUOTE" | "BOM";

export interface WebsiteEnquiryItem {
  mpn: string;
  manufacturer?: string;
  description?: string;
  quantity: number;
}

export function submitPublicLead(data: {
  source: WebsiteEnquirySource;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  companyName: string;
  subject?: string;
  message: string;
  deliveryLocation?: string;
  requiredDate?: string;
  items?: WebsiteEnquiryItem[];
  website?: string;
}, idempotencyKey?: string) {
  return apiFetch<{ referenceNumber: string; source: WebsiteEnquirySource }>("/leads", {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    body: JSON.stringify(data),
  });
}
