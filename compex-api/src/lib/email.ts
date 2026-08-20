import nodemailer from "nodemailer";
import { env } from "../config/env.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

function getTransport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  if (env.EMAIL_PROVIDER === "log") {
    console.log(`[EMAIL] To: ${opts.to} | Subject: ${opts.subject}`);
    console.log(`[EMAIL] Body: ${opts.html.substring(0, 200)}…`);
    return;
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.error("[EMAIL] SMTP credentials missing — email not sent to:", opts.to);
    return;
  }

  await getTransport().sendMail({
    from: `"Compex Solution" <${env.EMAIL_FROM}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
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
    <p>Dear ${customerName},</p>
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
    <p>Dear ${customerName},</p>
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
    <p>Dear ${customerName},</p>
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
