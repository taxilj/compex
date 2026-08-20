# Owner Requirements Checklist
> Source of truth: Stitch design screens + business workflow described by owner.
> Audit date: 2026-08-20

---

## 1. Website / UX
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1.1 | Public homepage with hero, value props, marquee | [COMPLETE] | HeroSection.tsx + ManufacturerMarquee.tsx |
| 1.2 | About / Company profile page | [COMPLETE] | /about |
| 1.3 | Services page | [COMPLETE] | /services |
| 1.4 | Sourcing page | [COMPLETE] | /sourcing |
| 1.5 | Resources page | [COMPLETE] | /resources |
| 1.6 | Case studies page | [COMPLETE] | /case-studies |
| 1.7 | Contact page with form | [PARTIAL] | UI exists; form submission not wired to backend |
| 1.8 | Customer login/register | [PARTIAL] | Login exists; no register page UI |
| 1.9 | Customer portal (dashboard, RFQs, quotes, orders, shipments, invoices) | [PARTIAL] | UI exists; quotes/orders/shipments/invoices use mock data |
| 1.10 | Admin ERP portal | [PARTIAL] | UI exists; most admin pages use hardcoded mock data |
| 1.11 | Mobile responsive layout | [PARTIAL] | Tailwind responsive classes used; not tested |
| 1.12 | Design system (Industrial Logic / Stitch) | [COMPLETE] | DESIGN.md, CSS tokens, Inter font, color palette |

---

## 2. Product Search
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 2.1 | Search by MPN, manufacturer, category, description | [PARTIAL] | /products UI exists; data is mock (src/data/mock/products.ts) |
| 2.2 | Real-time search suggestions / autocomplete | [MISSING] | No backend search endpoint |
| 2.3 | Database-backed product catalog | [MISSING] | No Product model in Prisma schema |
| 2.4 | Search results page with filters | [PARTIAL] | UI exists with mock data |
| 2.5 | Product data ingestion pipeline | [MISSING] | No import mechanism for real MPN data |

**Current:** Frontend `/products` page with hardcoded mock products  
**Files:** `src/app/(public)/products/page.tsx`, `src/data/mock/products.ts`  
**Backend/DB support:** None  
**Missing:** Product Prisma model, search API endpoint, product data source  

---

## 3. Product / Part-Number SEO
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 3.1 | /products/[mpn] dynamic pages | [PARTIAL] | Route exists; data is mock |
| 3.2 | Dynamic metadata (title, description) per MPN | [PARTIAL] | Page exists; meta from mock data |
| 3.3 | OpenGraph tags | [MISSING] | Not implemented |
| 3.4 | Structured data (JSON-LD) for products | [MISSING] | Not implemented |
| 3.5 | Canonical URLs | [MISSING] | Not explicitly set |
| 3.6 | Sitemap.xml | [MISSING] | Not generated |
| 3.7 | Robots.txt | [MISSING] | Not in public/ |
| 3.8 | Scalable MPN pages from real DB | [MISSING] | Requires real product database first |

---

## 4. Manufacturer Pages
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 4.1 | Manufacturer listing page | [PARTIAL] | /manufacturers page with mock logos |
| 4.2 | /manufacturers/[slug] SEO pages | [MISSING] | No dynamic manufacturer route |
| 4.3 | Manufacturer model in database | [MISSING] | No Manufacturer Prisma model |
| 4.4 | Real manufacturer data | [MISSING] | ManufacturerMarquee uses hardcoded list |

---

## 5. Category Pages
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 5.1 | Category listing page | [MISSING] | No /categories route |
| 5.2 | /categories/[slug] SEO pages | [MISSING] | Not implemented |
| 5.3 | Category model in database | [MISSING] | No Category Prisma model |

---

## 6. Industry Pages
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 6.1 | Industries listing page | [COMPLETE] | /industries page exists |
| 6.2 | /industries/[slug] dynamic pages | [MISSING] | No dynamic route |
| 6.3 | Industry design screens (Industrial Automation etc.) | [PARTIAL] | Static page; no dynamic content |

---

## 7. India Location Pages
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 7.1 | City-specific sourcing pages | [MISSING] | Not implemented |
| 7.2 | /sourcing/mumbai, /sourcing/delhi etc. | [MISSING] | Not implemented |
| 7.3 | Location-based SEO content | [MISSING] | Not implemented |

---

## 8. BOM Upload
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 8.1 | XLSX upload | [COMPLETE] | bom-upload.ts + bom-processor.ts |
| 8.2 | CSV upload | [COMPLETE] | Both formats supported |
| 8.3 | PDF upload | [MISSING] | Explicitly blocked in ALLOWED_EXTS |
| 8.4 | Word document upload | [MISSING] | Not supported |
| 8.5 | Image upload (photo of BOM) | [MISSING] | Not supported |
| 8.6 | BOM parsing to RFQ items | [COMPLETE] | BullMQ worker parses XLSX/CSV → rfq_items |
| 8.7 | Human review of parsed BOM before submit | [MISSING] | No review/correction UI |
| 8.8 | OCR / AI extraction for non-structured formats | [MISSING] | Phase 3 — evaluate cost/reliability first |
| 8.9 | BOM processing status tracking | [COMPLETE] | processingStatus field on Document model |

---

## 9. RFQ
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 9.1 | Customer creates RFQ (DRAFT) | [COMPLETE] | POST /api/rfqs |
| 9.2 | Add/edit/delete RFQ items | [COMPLETE] | CRUD on rfq_items |
| 9.3 | Submit RFQ | [COMPLETE] | PATCH /api/rfqs/:id/submit |
| 9.4 | RFQ number generation | [COMPLETE] | rfq-number.ts |
| 9.5 | Admin views submitted RFQs | [COMPLETE] | GET /api/admin/rfqs |
| 9.6 | Admin changes RFQ status | [COMPLETE] | PATCH /api/admin/rfqs/:id/status |
| 9.7 | Admin internal notes | [COMPLETE] | internalNotes field |
| 9.8 | Salesperson notified on RFQ submission | [MISSING] | No email trigger on submitRfq() |
| 9.9 | Customer notified on status change | [MISSING] | No email on admin status patch |
| 9.10 | RFQ priority (HIGH/MEDIUM/LOW) | [COMPLETE] | RFQPriority enum |
| 9.11 | Admin RFQ list connected to real backend | [MISSING] | Admin page uses hardcoded mockRFQs |
| 9.12 | Customer portal RFQ list connected to backend | [COMPLETE] | Portal calls listRfqs() API |

---

## 10. CRM / Lead Management
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 10.1 | Lead model (source, status, salesperson, priority, next-followup) | [MISSING] | No Lead Prisma model |
| 10.2 | Lead created when RFQ submitted | [MISSING] | No lead creation logic |
| 10.3 | Lead source attribution (Google Organic, Ads, LinkedIn, WhatsApp, Email, Direct, Referral) | [MISSING] | Not tracked |
| 10.4 | Lead status pipeline | [MISSING] | Not implemented |
| 10.5 | Salesperson assignment | [MISSING] | No Staff/Salesperson model relationship |
| 10.6 | Lead notes | [MISSING] | Not implemented |
| 10.7 | Next follow-up scheduling | [MISSING] | Not implemented |
| 10.8 | Revenue attribution | [MISSING] | Not implemented |
| 10.9 | Admin CRM view | [PARTIAL] | Stitch design screen exists; not wired |

---

## 11. Customer Quotation
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 11.1 | Admin creates quotation from RFQ | [MISSING] | No CustomerQuotation Prisma model |
| 11.2 | Apply margin to sourcing cost | [MISSING] | No margin logic |
| 11.3 | Generate quotation number | [MISSING] | Not implemented |
| 11.4 | Customer receives quotation email | [MISSING] | No email |
| 11.5 | PDF quotation generation | [MISSING] | Not implemented |
| 11.6 | Quotation validity tracking | [MISSING] | No validity date |
| 11.7 | Customer accepts/rejects quotation | [MISSING] | Not implemented |
| 11.8 | Vendor cost NEVER visible to customer | [NOT APPLICABLE] | Must be enforced at implementation |
| 11.9 | Customer portal quotation list | [PARTIAL] | UI exists; uses mock data |
| 11.10 | Quotation comparison view | [PARTIAL] | UI /portal/quotes/compare exists; mock only |

---

## 12. Vendor RFQ
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 12.1 | Admin selects vendor for RFQ items | [MISSING] | No Vendor Prisma model |
| 12.2 | Create VendorRfq from customer RFQ items | [MISSING] | No VendorRfq model |
| 12.3 | Generate vendor RFQ number | [MISSING] | Not implemented |
| 12.4 | Send vendor RFQ email | [MISSING] | email.ts abstraction exists (log mode) but no vendor email templates |
| 12.5 | Track vendor email status | [MISSING] | No email log/status model |
| 12.6 | Admin vendor management page | [PARTIAL] | UI exists; hardcoded mock data |

---

## 13. Vendor Quotation
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 13.1 | Record vendor quote (unit cost, lead time, MOQ) | [MISSING] | No VendorQuote Prisma model |
| 13.2 | Multi-vendor quote comparison | [MISSING] | No comparison logic; UI is mock |
| 13.3 | Admin selects best vendor quote | [MISSING] | Not implemented |
| 13.4 | Vendor quote internal (never shown to customer) | [NOT APPLICABLE] | Must be enforced at implementation |

---

## 14. Landed Cost Calculation
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 14.1 | Vendor unit cost (base) | [MISSING] | No VendorQuote model |
| 14.2 | Quantity | [MISSING] | Flows from RFQ items but no calc model |
| 14.3 | Currency + exchange rate | [MISSING] | Not implemented |
| 14.4 | Shipping cost | [MISSING] | Not implemented |
| 14.5 | Insurance | [MISSING] | Not implemented |
| 14.6 | Customs duty (configurable rate) | [MISSING] | Not implemented |
| 14.7 | IGST/GST (configurable rate) | [MISSING] | Not implemented |
| 14.8 | Handling charges | [MISSING] | Not implemented |
| 14.9 | Other import costs | [MISSING] | Not implemented |
| 14.10 | Margin percentage (configurable) | [MISSING] | Not implemented |
| 14.11 | Final customer price | [MISSING] | Not implemented |
| 14.12 | Decimal precision (NOT float) | [NOT APPLICABLE] | Must use Prisma Decimal at implementation |
| 14.13 | Landed cost UI | [PARTIAL] | Stitch design `costing_landed_cost_rfq_10452` exists; not wired |

**Formula (to implement):**
```
total_vendor_cost = unit_cost × quantity
cif = total_vendor_cost + shipping + insurance
landed = cif + customs_duty + igst + handling + other_costs
selling_price = landed × (1 + margin_pct / 100)
```
All fields: Decimal(18,4). All rates: configurable, not hardcoded.

---

## 15. Vendor Email Automation
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 15.1 | Send RFQ email to vendor | [MISSING] | email.ts exists (log-mode) but no vendor email templates |
| 15.2 | SMTP configuration | [PARTIAL] | env.ts has SMTP config vars; impl not wired |
| 15.3 | Email provider abstraction | [COMPLETE] | sendEmail() abstraction exists |
| 15.4 | Vendor email tracking | [MISSING] | No email log model |

---

## 16. Customer Email Automation
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 16.1 | RFQ confirmation email to customer | [MISSING] | submitRfq() has no email call |
| 16.2 | Quotation sent email | [MISSING] | No quotation email |
| 16.3 | Status change notification email | [MISSING] | Admin status patch has no email trigger |
| 16.4 | Email verification | [COMPLETE] | verificationEmail() function exists |

---

## 17. Follow-up Automation
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 17.1 | Day 1, 3, 7, 14 follow-up schedule | [MISSING] | No scheduler |
| 17.2 | Follow-up cancelled when quotation sent or order created | [MISSING] | No follow-up model |
| 17.3 | FollowUp task model | [MISSING] | Not in Prisma schema |
| 17.4 | Anti-spam protection | [MISSING] | Not implemented |

---

## 18. Inventory
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 18.1 | Part number, manufacturer, quantity, location | [MISSING] | No Inventory Prisma model |
| 18.2 | Date code, package type, availability | [MISSING] | Not implemented |
| 18.3 | Inventory admin UI | [PARTIAL] | Product catalog admin uses mock |
| 18.4 | Real inventory source | [MISSING] | No supplier data integration |
| 18.5 | No fake stock exposed publicly | [COMPLIANT] | No public inventory exposure currently |

---

## 19. Excess & Obsolete Inventory
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 19.1 | "Sell Your Excess Inventory" funnel | [MISSING] | No route or model |
| 19.2 | Inventory upload form | [MISSING] | Not implemented |
| 19.3 | Lead from excess inventory submission | [MISSING] | Not implemented |

---

## 20. WhatsApp
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 20.1 | "Send Part Number on WhatsApp" CTA | [MISSING] | No CTA on product pages |
| 20.2 | Prefilled WhatsApp message with MPN | [MISSING] | Not implemented |
| 20.3 | WhatsApp lead tracking | [MISSING] | No attribution |
| 20.4 | WhatsApp Business API | [NOT APPLICABLE] | Do not implement without credentials |

---

## 21. AI Chatbot
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 21.1 | AI assistant to collect RFQ details | [MISSING] | Phase 3 — do not build fake chatbot |
| 21.2 | AI creates RFQ from conversation | [MISSING] | Phase 3 |
| 21.3 | AI uses real backend data only | [NOT APPLICABLE] | Phase 3 prerequisite |

---

## 22. SEO Content Engine
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 22.1 | Automated MPN page content generation | [MISSING] | Phase 2 |
| 22.2 | Blog / articles | [MISSING] | No /blog route |
| 22.3 | FAQ pages | [MISSING] | No /faq route |
| 22.4 | Internal linking structure | [MISSING] | Not systematically implemented |

---

## 23. Google Analytics / Search Console
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 23.1 | GA4 snippet | [MISSING] | Not in layout.tsx |
| 23.2 | Google Search Console verification | [MISSING] | No verification meta tag |
| 23.3 | Event tracking (RFQ submit, quote view) | [MISSING] | Not implemented |

---

## 24. Google Ads Tracking
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 24.1 | Google Ads conversion pixel | [MISSING] | Not implemented |
| 24.2 | Conversion on RFQ submit | [MISSING] | Not implemented |

---

## 25. Meta Pixel
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 25.1 | Meta Pixel snippet | [MISSING] | Not in layout.tsx |
| 25.2 | Lead conversion event | [MISSING] | Not implemented |

---

## 26. LinkedIn Insight Tag
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 26.1 | LinkedIn Insight Tag | [MISSING] | Not in layout.tsx |

---

## 27. Marketing Automation
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 27.1 | UTM parameter capture on RFQ | [MISSING] | Not tracked |
| 27.2 | Lead source attribution | [MISSING] | No UTM capture in Lead model |
| 27.3 | Email campaign integration | [MISSING] | Not implemented |

---

## 28. Sales Dashboard
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 28.1 | New enquiries count | [MISSING] | Admin dashboard uses mock stats |
| 28.2 | Pending RFQs | [MISSING] | Mock only |
| 28.3 | Quotations due | [MISSING] | Mock only; no Quotation model |
| 28.4 | Follow-ups today | [MISSING] | Mock only; no FollowUp model |
| 28.5 | High-value leads | [MISSING] | No Lead model |
| 28.6 | Revenue metrics | [MISSING] | No Order/Revenue model |
| 28.7 | Qualified RFQs per month (owner's key KPI) | [MISSING] | Not tracked |

---

## 29. Analytics / KPI
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 29.1 | RFQ conversion funnel | [MISSING] | Not implemented |
| 29.2 | Revenue analytics | [MISSING] | No revenue data model |
| 29.3 | Admin reports page | [PARTIAL] | UI exists; mock data |

---

## 30. Admin ERP
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 30.1 | RFQ management | [PARTIAL] | Backend real; admin UI uses mock |
| 30.2 | Customer management | [PARTIAL] | Backend real; admin UI uses mock |
| 30.3 | Vendor management | [MISSING] | No Vendor model; admin UI uses mock |
| 30.4 | Product catalog management | [MISSING] | No Product model; admin UI uses mock |
| 30.5 | Order management | [MISSING] | No Order model; admin UI uses mock |
| 30.6 | Purchase order management | [MISSING] | No PurchaseOrder model; admin UI uses mock |
| 30.7 | Invoice management | [MISSING] | No Invoice model; admin UI uses mock |
| 30.8 | Shipment management | [MISSING] | No Shipment model; admin UI uses mock |
| 30.9 | Settings / system config | [PARTIAL] | UI exists; not wired |

---

## 31. Security
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 31.1 | Customer data isolation (tenant isolation) | [COMPLETE] | assertOwnership() in rfqs.service.ts |
| 31.2 | JWT httpOnly cookies | [COMPLETE] | Secure cookie config in auth.service.ts |
| 31.3 | Refresh token rotation | [COMPLETE] | RefreshToken model with family/revoke |
| 31.4 | RBAC (CUSTOMER/STAFF/ADMIN) | [COMPLETE] | requireRole middleware |
| 31.5 | Customer cannot see vendor costs | [NOT APPLICABLE] | Must be enforced when quotation is built |
| 31.6 | Customer cannot access admin APIs | [COMPLETE] | requireRole guard on /api/admin/* |
| 31.7 | Input validation | [COMPLETE] | Zod schemas on all endpoints |
| 31.8 | Audit logs | [COMPLETE] | AuditLog model; key actions logged |
| 31.9 | Rate limiting | [MISSING] | No rate limiter plugin on API |
| 31.10 | Signed document URLs | [PARTIAL] | Storage abstraction exists; signing requires S3 |
| 31.11 | Email verification | [COMPLETE] | EmailVerification model |

---

## 32. Performance
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 32.1 | Next.js App Router | [COMPLETE] | Next.js 15 |
| 32.2 | Core Web Vitals | [MISSING] | Not measured |
| 32.3 | Image optimization | [PARTIAL] | next/image not consistently used |
| 32.4 | Redis queue for heavy jobs | [COMPLETE] | BullMQ + IORedis for BOM |
| 32.5 | Database indexing | [MISSING] | No explicit @index in Prisma schema |

---

## 33. Mobile Responsiveness
| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 33.1 | Mobile-responsive public pages | [PARTIAL] | Tailwind classes; not tested |
| 33.2 | Mobile-responsive portal | [PARTIAL] | Tailwind classes; not tested |
| 33.3 | Mobile-responsive admin | [MISSING] | Admin sidebar layout likely broken on mobile |
