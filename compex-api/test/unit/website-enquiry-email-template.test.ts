import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    EMAIL_PROVIDER: "test",
    EMAIL_FROM: "info@compexsolution.com",
    NODE_ENV: "test",
  },
}));

vi.mock("../../src/lib/prisma.js", () => ({ prisma: {} }));

import { websiteEnquiryEmail } from "../../src/lib/email.js";

describe("website enquiry email template", () => {
  it("clearly identifies sales notifications as website enquiries", () => {
    const html = websiteEnquiryEmail({
      referenceNumber: "RFQ-2026-000002",
      source: "REQUEST_QUOTE",
      submittedAt: "2026-11-26T05:27:16.445Z",
      contactName: "Demo Buyer",
      companyName: "Demo Company",
      contactEmail: "buyer@example.com",
      message: "Please quote.",
      items: [{ mpn: "0008500113", manufacturer: "Molex", quantity: 10 }],
      adminUrl: "https://compex-frontend.vercel.app/admin/leads",
    });

    expect(html).toContain("<strong>Origin</strong>");
    expect(html).toContain("Compex website (compex-frontend.vercel.app)");
  });
});
