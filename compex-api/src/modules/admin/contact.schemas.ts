import { z } from "zod";

// The KAS CRM Customer and Supplier Masters share this contact shape. Keep
// the legacy `role` key for existing clients while preserving the richer
// owner-defined fields in the JSON contacts column.
export const ContactEntry = z.object({
  name: z.string().trim().min(1).max(200),
  shortName: z.string().trim().max(100).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(50).optional(),
  mobile: z.string().trim().max(50).optional(),
  status: z.string().trim().max(50).optional(),
  division: z.string().trim().max(100).optional(),
  position: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(500).optional(),
  role: z.string().trim().max(100).optional(),
});
