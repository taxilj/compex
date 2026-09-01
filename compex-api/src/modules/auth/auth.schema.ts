import { z } from "zod";

export const RegisterSchema = z.object({
  companyName: z.string().min(2).max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().toLowerCase(),
  phone: z.string().min(7).max(20),
  gstin: z.string().max(15).optional(),
  city: z.string().max(100).optional(),
  password: z
    .string()
    .min(10)
    .regex(
      /^(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter and one number",
    ),
});

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const CompleteAccountSetupSchema = z.object({
  token: z.string().min(1),
  password: RegisterSchema.shape.password,
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CompleteAccountSetupInput = z.infer<typeof CompleteAccountSetupSchema>;
