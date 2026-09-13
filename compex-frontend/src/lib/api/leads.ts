import { apiFetch } from "./client";

export type WebsiteEnquirySource = "CONTACT" | "REQUEST_QUOTE" | "BOM";
export type LeadDocumentProcessingStatus = "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface WebsiteEnquiryItem {
  mpn: string;
  manufacturer?: string;
  description?: string;
  quantity: number;
}

export interface LeadBomStatus {
  documentId: string;
  fileName: string;
  processingStatus: LeadDocumentProcessingStatus;
  processingError: string | null;
  fileSizeBytes: number;
  validItemCount?: number;
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
  return apiFetch<{ id: string; referenceNumber: string; source: WebsiteEnquirySource }>("/leads", {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    body: JSON.stringify(data),
  });
}

// Real, non-hardcoded readiness signal -- never assume storage is available.
export function getBomCapability() {
  return apiFetch<{ available: boolean }>("/leads/bom-capability");
}

export function uploadLeadBom(leadId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<LeadBomStatus & { duplicate: boolean }>(`/leads/${leadId}/bom`, {
    method: "POST",
    body: form,
  });
}

export function getLeadBomStatus(leadId: string) {
  return apiFetch<LeadBomStatus>(`/leads/${leadId}/bom`);
}
