import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./uploads"),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  // `test` is deliberately usable only with NODE_ENV=test. It stores mail in
  // the isolated test database so browser QA can follow a normal email link
  // without exposing verification tokens in application logs.
  EMAIL_PROVIDER: z.enum(["log", "smtp", "test"]).default("log"),
  EMAIL_FROM: z.string().default("noreply@compexsolution.com"),
  ENQUIRY_NOTIFICATION_TO: z.string().email().default("sales@compexsolution.com"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.STORAGE_PROVIDER === "s3") {
    for (const key of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const) {
      if (!value[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required when STORAGE_PROVIDER=s3` });
    }
  }
  if (value.EMAIL_PROVIDER === "smtp") {
    for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const) {
      if (!value[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required when EMAIL_PROVIDER=smtp` });
    }
  }
  if (value.EMAIL_PROVIDER === "test" && value.NODE_ENV !== "test") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["EMAIL_PROVIDER"], message: "EMAIL_PROVIDER=test requires NODE_ENV=test" });
  }
  if (value.NODE_ENV === "production" && value.EMAIL_PROVIDER !== "smtp") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["EMAIL_PROVIDER"], message: "Production requires EMAIL_PROVIDER=smtp" });
  }
  if (value.NODE_ENV === "production" && value.STORAGE_PROVIDER !== "s3") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["STORAGE_PROVIDER"], message: "Production requires persistent S3-compatible storage" });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
