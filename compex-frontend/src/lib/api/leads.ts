import { apiFetch } from "./client";

export function submitPublicLead(data: {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  companyName: string;
  subject?: string;
  message: string;
}) {
  return apiFetch<{ id: string }>("/leads", { method: "POST", body: JSON.stringify(data) });
}
