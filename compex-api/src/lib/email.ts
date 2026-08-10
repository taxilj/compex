import { env } from "../config/env.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Abstraction for email — dev uses log adapter, prod wires SMTP
export async function sendEmail(opts: EmailOptions): Promise<void> {
  if (env.EMAIL_PROVIDER === "log") {
    console.log(`[EMAIL] To: ${opts.to} | Subject: ${opts.subject}`);
    console.log(`[EMAIL] Body: ${opts.html}`);
    return;
  }
  // ponytail: SMTP wiring — add nodemailer when EMAIL_PROVIDER=smtp is needed
  throw new Error("SMTP email provider not yet configured");
}

export function verificationEmail(token: string, baseUrl: string): string {
  return `<p>Verify your email: <a href="${baseUrl}/verify-email?token=${token}">Click here</a></p><p>Expires in 24 hours.</p>`;
}