import { describe, expect, it } from "vitest";
import { COMPANY_EMAIL, COMPANY_GSTIN, COMPANY_PHONE, COMPANY_POSTAL_ADDRESS } from "@/lib/constants/contact";
import { SITE_URL } from "@/lib/site";
import { HOME_FAQS, homeStructuredData, organizationStructuredData } from "./structured-data";

describe("home structured data", () => {
  it("uses the published company identity and factual contact details", () => {
    expect(organizationStructuredData).toMatchObject({
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      url: SITE_URL,
      email: COMPANY_EMAIL,
      telephone: COMPANY_PHONE,
      taxID: COMPANY_GSTIN,
      address: COMPANY_POSTAL_ADDRESS,
    });
  });

  it("keeps FAQ schema aligned with the visible homepage questions", () => {
    const faqPage = homeStructuredData["@graph"].find((item) => item["@type"] === "FAQPage");
    expect(faqPage).toBeDefined();
    expect(faqPage?.mainEntity).toHaveLength(HOME_FAQS.length);
    expect(faqPage?.mainEntity.map((item) => item.name)).toEqual(HOME_FAQS.map((faq) => faq.question));
  });

  it("does not invent ratings, reviews, prices, or product availability", () => {
    const fields = new Set<string>();
    const collectFields = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(collectFields);
      else if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, child]) => {
          fields.add(key);
          collectFields(child);
        });
      }
    };
    collectFields(homeStructuredData);
    for (const field of ["aggregateRating", "review", "offers", "availability", "price"]) {
      expect(fields.has(field)).toBe(false);
    }
  });
});
