import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

interface EmailOptions {
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
  // Used only by the isolated test provider. Never log this value.
  testActionUrl?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";
// Defense-in-depth, same rationale as the old nodemailer connection/socket
// timeouts this replaces: bounds how long a single send can hang the caller
// regardless of any outer timeout (see auth.service.ts's withTimeout()).
const RESEND_TIMEOUT_MS = 10_000;

// Thrown for any non-2xx response or network-level failure talking to the
// Resend API. `.message` is deliberately generic and never carries the raw
// Resend response body -- that body can echo back request fields (recipient,
// subject) and it must stay safe to pass to a plain `console.error(err)`
// call site elsewhere in the codebase. `.code` and `.statusCode` carry the
// safe, non-content diagnostic details instead.
export class EmailProviderError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, opts: { code?: string; statusCode?: number; cause?: unknown } = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "EmailProviderError";
    this.code = opts.code;
    this.statusCode = opts.statusCode;
  }
}

async function sendViaResend(opts: EmailOptions): Promise<{ messageId?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        // Never logged: kept only in this request's Authorization header.
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `"Compex Solution" <${env.EMAIL_FROM}>`,
        to: [opts.to],
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        subject: opts.subject,
        html: opts.html,
        ...(opts.attachments?.length
          ? {
              attachments: opts.attachments.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content.toString("base64"),
                content_type: attachment.contentType,
              })),
            }
          : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new EmailProviderError("Resend API request timed out", { code: "ETIMEDOUT" });
    }
    throw new EmailProviderError("Resend API request failed", {
      code: error instanceof Error ? error.name : "NetworkError",
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Resend's JSON error body is `{ name, message }`. `name` is a stable
    // error-type identifier (e.g. "validation_error", "rate_limit_exceeded")
    // safe to log; the free-text `message` is intentionally never attached
    // to the thrown error -- see EmailProviderError above.
    let errorCode: string | undefined;
    try {
      const body = (await response.json()) as { name?: unknown };
      errorCode = typeof body?.name === "string" ? body.name : undefined;
    } catch {
      // Non-JSON error body -- fall through with no code.
    }
    throw new EmailProviderError(`Resend API rejected the request (status ${response.status})`, {
      code: errorCode,
      statusCode: response.status,
    });
  }

  const data = (await response.json()) as { id?: string };
  return { messageId: data.id };
}

export async function sendEmail(opts: EmailOptions): Promise<{ messageId?: string }> {
  if (env.EMAIL_PROVIDER === "log") {
    throw new Error("Email delivery is disabled in this environment");
  }

  if (env.EMAIL_PROVIDER === "test") {
    if (env.NODE_ENV !== "test") {
      throw new Error("The test email provider is allowed only when NODE_ENV=test");
    }
    await prisma.testEmail.create({
      data: {
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        actionUrl: opts.testActionUrl,
      },
    });
    return { messageId: "test-email" };
  }

  if (!env.RESEND_API_KEY) {
    throw new Error("Email provider is not configured");
  }

  return sendViaResend(opts);
}

function escapeHtml(value?: string | null): string {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return (value ?? "").replace(/[&<>"']/g, (char) => replacements[char]!);
}

export function websiteEnquiryEmail(input: {
  referenceNumber: string;
  source: "CONTACT" | "REQUEST_QUOTE" | "BOM";
  submittedAt: string;
  contactName: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  subject?: string;
  message: string;
  deliveryLocation?: string;
  requiredDate?: string;
  items: Array<{ mpn: string; manufacturer?: string | null; description?: string | null; quantity: number }>;
  adminUrl: string;
}): string {
  const items = input.items.length
    ? `<ul>${input.items.map((item) => `<li>${escapeHtml(item.mpn)}${item.manufacturer ? ` — ${escapeHtml(item.manufacturer)}` : ""} × ${item.quantity}</li>`).join("")}</ul>`
    : "<p>No line items supplied.</p>";
  return `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#333">
  <h2>New ${input.source === "CONTACT" ? "Website Enquiry" : input.source === "BOM" ? "BOM Enquiry" : "RFQ"} — ${escapeHtml(input.referenceNumber)}</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td><strong>Reference</strong></td><td>${escapeHtml(input.referenceNumber)}</td></tr>
    <tr><td><strong>Source</strong></td><td>${escapeHtml(input.source.replaceAll("_", " "))}</td></tr>
    <tr><td><strong>Submitted</strong></td><td>${escapeHtml(input.submittedAt)}</td></tr>
    <tr><td><strong>Customer</strong></td><td>${escapeHtml(input.contactName)}</td></tr>
    <tr><td><strong>Company</strong></td><td>${escapeHtml(input.companyName)}</td></tr>
    <tr><td><strong>Email</strong></td><td>${escapeHtml(input.contactEmail)}</td></tr>
    ${input.contactPhone ? `<tr><td><strong>Phone</strong></td><td>${escapeHtml(input.contactPhone)}</td></tr>` : ""}
    ${input.subject ? `<tr><td><strong>Subject</strong></td><td>${escapeHtml(input.subject)}</td></tr>` : ""}
    ${input.deliveryLocation ? `<tr><td><strong>Delivery location</strong></td><td>${escapeHtml(input.deliveryLocation)}</td></tr>` : ""}
    ${input.requiredDate ? `<tr><td><strong>Required date</strong></td><td>${escapeHtml(input.requiredDate)}</td></tr>` : ""}
  </table>
  <h3>Items</h3>${items}
  <h3>Message</h3><p>${escapeHtml(input.message).replaceAll("\n", "<br>")}</p>
  <p><a href="${escapeHtml(input.adminUrl)}">Review in Compex Admin</a></p>
</div>`;
}

export function rfqConfirmationEmail(
  customerName: string,
  rfqNumber: string,
  itemCount: number,
  deliveryLocation: string | null,
): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#0B1F3A;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">Compex Solution</h1>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Electronic Component Sourcing & Procurement</p>
  </div>
  <div style="padding:32px">
    <h2 style="color:#0B1F3A;margin-top:0">RFQ Received — ${rfqNumber}</h2>
    <p>Dear ${escapeHtml(customerName)},</p>
    <p>Thank you for submitting your Request for Quotation. We have received your requirement and our sourcing team will review it shortly.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr><td style="padding:8px;color:#666;width:40%">RFQ Number</td><td style="padding:8px;font-weight:bold">${rfqNumber}</td></tr>
      <tr style="background:#f8f8f8"><td style="padding:8px;color:#666">Items</td><td style="padding:8px">${itemCount} line item${itemCount !== 1 ? "s" : ""}</td></tr>
      ${deliveryLocation ? `<tr><td style="padding:8px;color:#666">Delivery Location</td><td style="padding:8px">${deliveryLocation}</td></tr>` : ""}
    </table>
    <p><strong>What happens next?</strong></p>
    <ol style="color:#555;line-height:1.8">
      <li>Our team reviews your requirement (typically within 1 business day)</li>
      <li>We source from our verified vendor network</li>
      <li>You receive a detailed quotation with pricing and lead times</li>
    </ol>
    <p>If you have any questions, please contact us at <a href="mailto:sales@compexsolution.com">sales@compexsolution.com</a>.</p>
  </div>
  <div style="background:#f4f4f4;padding:16px 32px;font-size:12px;color:#888;text-align:center">
    Compex Solution Pvt. Ltd. &nbsp;|&nbsp; sales@compexsolution.com
  </div>
</div>`;
}

export function quotationEmail(
  customerName: string,
  quotationNumber: string,
  total: string,
  currency: string,
  validUntil: string,
  portalUrl: string,
): string {
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#0B1F3A;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">Compex Solution</h1>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Electronic Component Sourcing & Procurement</p>
  </div>
  <div style="padding:32px">
    <h2 style="color:#0B1F3A;margin-top:0">Quotation Ready — ${quotationNumber}</h2>
    <p>Dear ${escapeHtml(customerName)},</p>
    <p>Your quotation is ready. Please find the details below.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr><td style="padding:8px;color:#666;width:40%">Quotation Number</td><td style="padding:8px;font-weight:bold">${quotationNumber}</td></tr>
      <tr style="background:#f8f8f8"><td style="padding:8px;color:#666">Total</td><td style="padding:8px;font-weight:bold">${currency} ${total}</td></tr>
      <tr><td style="padding:8px;color:#666">Valid Until</td><td style="padding:8px">${validUntil}</td></tr>
    </table>
    <p style="margin:24px 0">
      <a href="${portalUrl}" style="background:#1769E0;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">View Quotation</a>
    </p>
    <p style="font-size:13px;color:#666">The quotation PDF is attached to this email for your reference.</p>
    <p>For any questions, contact us at <a href="mailto:sales@compexsolution.com">sales@compexsolution.com</a>.</p>
  </div>
  <div style="background:#f4f4f4;padding:16px 32px;font-size:12px;color:#888;text-align:center">
    Compex Solution Pvt. Ltd. &nbsp;|&nbsp; sales@compexsolution.com
  </div>
</div>`;
}

export function vendorRfqEmail(
  vendorName: string,
  vendorRfqNumber: string,
  items: Array<{ mpn: string; manufacturer?: string | null; quantity: number }>,
  notes?: string | null,
): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(item.mpn)}</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(item.manufacturer ?? "—")}</td><td style="padding:8px;border-bottom:1px solid #eee">${item.quantity}</td></tr>`,
    )
    .join("");
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#0B1F3A;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">Compex Solution</h1>
    <p style="color:#aac;margin:4px 0 0;font-size:13px">Electronic Component Sourcing & Procurement</p>
  </div>
  <div style="padding:32px">
    <h2 style="color:#0B1F3A;margin-top:0">Request for Quotation — ${escapeHtml(vendorRfqNumber)}</h2>
    <p>Dear ${escapeHtml(vendorName)},</p>
    <p>We would like to request your best pricing, lead time, and MOQ for the following components:</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">MPN</th><th style="padding:8px;text-align:left">Manufacturer</th><th style="padding:8px;text-align:left">Quantity</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${notes ? `<p><strong>Additional notes:</strong> ${escapeHtml(notes)}</p>` : ""}
    <p>Please reply to this email with your quotation at your earliest convenience.</p>
  </div>
  <div style="background:#f4f4f4;padding:16px 32px;font-size:12px;color:#888;text-align:center">
    Compex Solution Pvt. Ltd. &nbsp;|&nbsp; sales@compexsolution.com
  </div>
</div>`;
}

export function followUpEmail(
  customerName: string,
  rfqNumber: string,
  type: "DAY_1" | "DAY_3" | "DAY_7" | "DAY_14",
  quotationNumber?: string,
): string {
  const messages: Record<string, string> = {
    DAY_1: `We wanted to confirm that we have received your RFQ <strong>${rfqNumber}</strong> and our team is actively working on it. You can expect a detailed quotation soon.`,
    DAY_3: quotationNumber
      ? `Your quotation <strong>${quotationNumber}</strong> for RFQ <strong>${rfqNumber}</strong> has been prepared. Please log in to your portal to review and accept it.`
      : `We are still working on sourcing components for your RFQ <strong>${rfqNumber}</strong>. We will update you as soon as we have pricing.`,
    DAY_7: `We wanted to check in on your requirement for RFQ <strong>${rfqNumber}</strong>. Please let us know if your requirement is still active or if we can assist further.`,
    DAY_14: `This is a final follow-up regarding your RFQ <strong>${rfqNumber}</strong>. If you are still looking for components, we are here to help.`,
  };

  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:#0B1F3A;padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">Compex Solution</h1>
  </div>
  <div style="padding:32px">
    <p>Dear ${escapeHtml(customerName)},</p>
    <p>${messages[type]}</p>
    <p>Contact us at <a href="mailto:sales@compexsolution.com">sales@compexsolution.com</a>.</p>
  </div>
  <div style="background:#f4f4f4;padding:16px 32px;font-size:12px;color:#888;text-align:center">
    Compex Solution Pvt. Ltd. &nbsp;|&nbsp; sales@compexsolution.com
  </div>
</div>`;
}

export function verificationEmail(token: string, baseUrl: string): string {
  return `<p>Verify your email: <a href="${baseUrl}/verify-email?token=${token}">Click here</a></p><p>Expires in 24 hours.</p>`;
}

export function accountSetupEmail(token: string, baseUrl: string): string {
  const setupUrl = `${baseUrl}/setup-account?token=${encodeURIComponent(token)}`;
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <h2>Set up your Compex Solution customer account</h2>
  <p>An administrator created a customer account for you. Confirm control of this email and choose your own password to activate it.</p>
  <p><a href="${setupUrl}">Set up account</a></p>
  <p>This link expires in 24 hours and can be used once.</p>
</div>`;
}
