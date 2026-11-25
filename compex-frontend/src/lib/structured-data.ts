import {
  COMPANY_EMAIL,
  COMPANY_GSTIN,
  COMPANY_LEGAL_NAME,
  COMPANY_PHONE,
  COMPANY_POSTAL_ADDRESS,
} from "@/lib/constants/contact";
import { SITE_URL } from "@/lib/site";
import type { BackendProduct } from "@/lib/api/products";

export const HOME_FAQS = [
  {
    question: "What information should I include in an electronic component enquiry?",
    answer:
      "Include the manufacturer part number (MPN), manufacturer where known, required quantity, target delivery date, and any BOM file or technical requirements.",
  },
  {
    question: "Can I request a component that is not listed in the catalogue?",
    answer:
      "Yes. Submit an RFQ with the exact MPN and requirement details. Compex reviews the sourcing requirement and responds with the next steps.",
  },
  {
    question: "Who does Compex Solution serve?",
    answer:
      "Compex Solution supports procurement teams and design engineers at Indian manufacturing businesses that need electronic components sourced from global suppliers.",
  },
  {
    question: "How does BOM sourcing work?",
    answer:
      "Share a Bill of Materials with the required quantities and specifications. Compex reviews the requirement, sources the component lines, and prepares the quotation process.",
  },
] as const;

const organization = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: COMPANY_LEGAL_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/compex-logo.jpeg`,
  description: "Electronic component sourcing and procurement for Indian manufacturing businesses.",
  email: COMPANY_EMAIL,
  telephone: COMPANY_PHONE,
  taxID: COMPANY_GSTIN,
  address: COMPANY_POSTAL_ADDRESS,
  areaServed: { "@type": "Country", name: "India" },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "sales",
    email: COMPANY_EMAIL,
    telephone: COMPANY_PHONE,
    availableLanguage: "en",
  },
} as const;

export const homeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    organization,
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: COMPANY_LEGAL_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-IN",
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: HOME_FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ],
} as const;

/**
 * Build factual schema for a catalogue product page. Commercial fields such as
 * price, availability, ratings and offers are intentionally omitted because
 * Compex does not publish verified values for them yet.
 */
export function productStructuredData(product: BackendProduct, path: string) {
  const productUrl = `${SITE_URL}${path}`;
  const description = product.description ?? product.name ?? `Electronic component ${product.mpn}.`;
  const properties = Object.entries(product.specifications ?? {})
    .filter(([name, value]) => String(name).trim() && String(value).trim())
    .map(([name, value]) => ({
      "@type": "PropertyValue",
      name,
      value: String(value),
    }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${productUrl}#product`,
        name: product.name ? `${product.mpn} — ${product.name}` : product.mpn,
        mpn: product.mpn,
        description,
        url: productUrl,
        ...(product.images.length > 0 ? { image: product.images } : {}),
        ...(product.manufacturer ? {
          brand: { "@type": "Brand", name: product.manufacturer.name },
          manufacturer: { "@type": "Organization", name: product.manufacturer.name },
        } : {}),
        ...(product.category?.name ? { category: product.category.name } : {}),
        ...(properties.length > 0 ? { additionalProperty: properties } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Products", item: `${SITE_URL}/products` },
          { "@type": "ListItem", position: 3, name: product.mpn, item: productUrl },
        ],
      },
    ],
  } as const;
}

export { organization as organizationStructuredData };
