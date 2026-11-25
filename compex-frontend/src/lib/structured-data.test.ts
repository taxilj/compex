import { describe, expect, it } from "vitest";
import { COMPANY_EMAIL, COMPANY_GSTIN, COMPANY_PHONE, COMPANY_POSTAL_ADDRESS } from "@/lib/constants/contact";
import { SITE_URL } from "@/lib/site";
import { HOME_FAQS, homeStructuredData, organizationStructuredData, productStructuredData } from "./structured-data";

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

describe("product structured data", () => {
  it("exposes the exact MPN and factual catalogue properties without commercial claims", () => {
    const data = productStructuredData({
      id: "p1",
      mpn: "STM32F103C8T6",
      name: "32-bit microcontroller",
      description: "ARM Cortex-M3 microcontroller",
      specifications: { Package: "LQFP-48", "Supply Voltage": "2V-3.6V" },
      packageType: "LQFP-48",
      mountingType: "Surface Mount",
      lifecycleStatus: "ACTIVE",
      datasheetUrl: "https://example.com/datasheet.pdf",
      images: ["https://example.com/part.png"],
      manufacturer: { id: "m1", name: "STMicroelectronics", slug: "st", logoUrl: null, website: null, description: null, country: "CH" },
      category: { id: "c1", name: "Microcontrollers", description: null, parentId: null },
    }, "/products/STM32F103C8T6");

    const product = data["@graph"].find((item) => item["@type"] === "Product");
    expect(product).toMatchObject({ mpn: "STM32F103C8T6", url: `${SITE_URL}/products/STM32F103C8T6` });
    expect(product).toHaveProperty("brand.name", "STMicroelectronics");
    expect(product).toHaveProperty("additionalProperty");
    expect(product).not.toHaveProperty("offers");
    expect(product).not.toHaveProperty("aggregateRating");
  });
});
