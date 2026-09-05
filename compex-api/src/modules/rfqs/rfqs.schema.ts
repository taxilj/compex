import { z } from "zod";

export const CreateRfqSchema = z.object({
  deliveryLocation: z.string().max(200).optional(),
  requiredDate: z.string().date().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  additionalNotes: z.string().max(2000).optional(),
});

export const UpdateRfqSchema = z.object({
  deliveryLocation: z.string().max(200).optional(),
  requiredDate: z.string().date().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  additionalNotes: z.string().max(2000).optional(),
});

export const CreateRfqItemSchema = z.object({
  mpn: z.string().min(1).max(100),
  manufacturer: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  quantity: z.number().int().positive(),
  targetPriceUsd: z.number().nonnegative().optional(),
  requiredDate: z.string().date().optional(),
  notes: z.string().max(500).optional(),
  // Optional link to a catalog Product (Phase 6). When present, the server
  // overwrites mpn/manufacturer/description from the product record rather
  // than trusting client-supplied text for a linked item.
  productId: z.string().uuid().optional(),
});

export const UpdateRfqItemSchema = CreateRfqItemSchema.partial();

export const RfqListQuerySchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SOURCING", "CANCELLED"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateRfqInput = z.infer<typeof CreateRfqSchema>;
export type UpdateRfqInput = z.infer<typeof UpdateRfqSchema>;
export type CreateRfqItemInput = z.infer<typeof CreateRfqItemSchema>;
export type UpdateRfqItemInput = z.infer<typeof UpdateRfqItemSchema>;
export type RfqListQuery = z.infer<typeof RfqListQuerySchema>;