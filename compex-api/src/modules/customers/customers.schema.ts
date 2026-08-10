import { z } from "zod";

export const UpdateCompanySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  gstin: z.string().max(15).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
});

export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;