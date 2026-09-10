import { apiFetch } from "./client";

export type DocumentProcessingStatus = "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface RfqDocument {
  id: string;
  fileName: string;
  documentType: string;
  processingStatus: DocumentProcessingStatus;
  processingError: string | null;
  fileSizeBytes: number;
  createdAt: string;
}

export function listRfqDocuments(rfqId: string) {
  return apiFetch<RfqDocument[]>(`/rfqs/${rfqId}/documents`);
}
