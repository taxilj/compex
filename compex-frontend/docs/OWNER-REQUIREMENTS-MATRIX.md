# Owner Requirements Matrix
> Audit date: 2026-08-20

| Requirement | Priority | Status | Frontend | Backend | Database | API | Automation | Missing Work | Dependencies | Phase |
|-------------|----------|--------|----------|---------|----------|-----|------------|--------------|--------------|-------|
| Vendor model | P0 | MISSING | N/A | None | None | None | None | Prisma model + CRUD routes | None | P0-A |
| Manufacturer model | P0 | MISSING | Partial (mock) | None | None | None | None | Prisma model + CRUD routes | None | P0-A |
| VendorRfq model | P0 | MISSING | Partial (mock) | None | None | None | None | Prisma model + admin routes | Vendor | P0-A |
| VendorQuote model | P0 | MISSING | Partial (mock) | None | None | None | None | Prisma model + admin routes | VendorRfq | P0-A |
| Admin RFQ list wired to real backend | P0 | MISSING | Mock only | Real API exists | Real DB | Exists | N/A | Wire admin page to GET /api/admin/rfqs | None | P0-A |
| Rate limiting on API | P0 | MISSING | N/A | None | N/A | None | None | fastify-rate-limit plugin | None | P0-A |
| Lead/CRM model | P0 | MISSING | None | None | None | None | None | Lead Prisma model, auto-create on RFQ submit | RFQ submit | P0-B |
| Landed cost calculation | P0 | MISSING | Partial (Stitch design) | None | None | None | None | LandedCost Prisma model (Decimal), formula, admin UI | VendorQuote | P0-B |
| RFQ confirmation email to customer | P0 | MISSING | N/A | submitRfq() exists | N/A | None | None | Add sendEmail() in submitRfq() | SMTP creds | P0-B |
| Salesperson notification on RFQ submit | P0 | MISSING | None | Exists (no email) | N/A | None | None | Add sendEmail() call in submitRfq() | SMTP creds | P0-B |
| SMTP production wiring | P0 | BLOCKED | N/A | Abstraction exists | N/A | None | None | nodemailer + env SMTP creds from owner | Owner provides | P0-B |
| Customer Quotation model | P0 | MISSING | Partial (mock) | None | None | None | None | CustomerQuotation Prisma model + CRUD + API | LandedCost | P0-C |
| Quotation PDF generation | P0 | MISSING | None | None | None | None | None | PDF library (react-pdf or puppeteer) | CustomerQuotation | P0-C |
| Quotation email to customer | P0 | MISSING | None | None | None | None | None | SMTP + email template + send trigger | SMTP creds, Quotation | P0-C |
| Vendor RFQ email | P0 | MISSING | None | None | None | None | None | SMTP + vendor email template | SMTP creds, VendorRfq | P0-C |
| Follow-up automation (Day 1,3,7,14) | P0 | MISSING | None | None | None | None | None | FollowUp model, scheduler job | Lead, Quotation | P0-D |
| Sales dashboard (real data) | P0 | MISSING | Mock only | None | None | None | None | Dashboard aggregate API endpoint | Quotation, Lead | P0-D |
| Product/MPN model | P1 | MISSING | Mock | None | None | None | None | Product Prisma model + search API | None | P1 |
| Part-number SEO pages (real data) | P1 | MISSING | Mock data | None | None | None | None | Real MPN data in DB | Product model | P1 |
| Manufacturer listing (real data) | P1 | MISSING | Mock | None | None | None | None | Manufacturer data in DB | Manufacturer model | P1 |
| Category pages | P1 | MISSING | None | None | None | None | None | Category model + routes | None | P1 |
| Industry detail pages | P1 | MISSING | Static only | None | None | None | None | Dynamic /industries/[slug] | None | P1 |
| India location pages | P1 | MISSING | None | None | None | None | None | /sourcing/[city] routes | None | P1 |
| Inventory model | P1 | MISSING | Mock | None | None | None | None | Inventory Prisma model | None | P1 |
| Admin customers wired to real API | P1 | MISSING | Mock | Real API exists | Real DB | Exists | N/A | Wire admin customer page | None | P1 |
| Customer registration page | P1 | MISSING | None | Auth service exists | Real DB | Exists | None | Register page UI | None | P1 |
| Contact form backend | P1 | MISSING | Exists | None | None | None | None | POST /api/contact endpoint | None | P1 |
| Sitemap.xml | P1 | MISSING | None | None | N/A | None | None | Next.js sitemap.ts | Product model | P1 |
| Robots.txt | P1 | MISSING | None | None | N/A | None | None | public/robots.txt | None | P1 |
| OpenGraph / Structured data | P1 | MISSING | None | None | N/A | None | None | Next.js metadata API | None | P1 |
| BOM human review UI | P1 | MISSING | None | None | N/A | None | None | Pre-submit review step in portal | BOM parser | P1 |
| DB indexes on hot queries | P1 | MISSING | N/A | N/A | None | N/A | None | @index on rfqs.status, rfqs.customer_id | None | P1 |
| Signed document URLs (S3) | P1 | BLOCKED | N/A | Abstraction exists | N/A | None | None | S3 credentials | Owner provides | P1 |
| WhatsApp CTA on product pages | P2 | MISSING | None | None | N/A | None | None | wa.me link + UTM tracking | None | P2 |
| GA4 integration | P2 | MISSING | None | None | N/A | None | None | Script in layout.tsx + events | GA4 creds | P2 |
| Google Ads conversion tracking | P2 | MISSING | None | None | N/A | None | None | Conversion pixel | Ads creds | P2 |
| Meta Pixel | P2 | MISSING | None | None | N/A | None | None | Script in layout.tsx | Meta creds | P2 |
| LinkedIn Insight Tag | P2 | MISSING | None | None | N/A | None | None | Script in layout.tsx | LI creds | P2 |
| UTM capture on RFQ | P2 | MISSING | None | None | None | None | None | UTM fields in Lead model | Lead model | P2 |
| Excess & Obsolete inventory funnel | P2 | MISSING | None | None | None | None | None | New route + form + lead creation | Lead model | P2 |
| Blog / FAQ / articles | P2 | MISSING | None | None | N/A | None | None | CMS or MDX pages | None | P2 |
| PDF/Word/Image BOM parsing | P2 | MISSING | None | None | None | None | None | OCR pipeline | Evaluate vendors | P2 |
| AI chatbot (RFQ creation) | P3 | MISSING | None | None | None | None | None | LLM integration + RFQ creation from chat | Real product DB | P3 |
| Advanced OCR BOM | P3 | MISSING | None | None | None | None | None | Document AI / Textract pipeline | Evaluate cost | P3 |
