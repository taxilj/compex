// Single source of truth for the owner's published contact details.
// Referenced by the shared footer (and anywhere else contact info is
// needed) instead of duplicating hard-coded strings.
export const COMPANY_PHONE = "+91-9428248855";
export const COMPANY_PHONE_TEL_HREF = "tel:+919428248855";
export const COMPANY_EMAIL = "sales@compexsolution.com";
export const COMPANY_EMAIL_MAILTO_HREF = `mailto:${COMPANY_EMAIL}`;
export const COMPANY_LEGAL_NAME = "Compex Solution";
export const COMPANY_GSTIN = "24AXTPP3370L1ZU";
export const COMPANY_ADDRESS = "A-35, F-7, GEMA Building, Sector-25, GIDC, Gandhinagar, Gujarat, India - 382016";
export const COMPANY_POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "A-35, F-7, GEMA Building, Sector-25, GIDC",
  addressLocality: "Gandhinagar",
  addressRegion: "Gujarat",
  postalCode: "382016",
  addressCountry: "IN",
} as const;
