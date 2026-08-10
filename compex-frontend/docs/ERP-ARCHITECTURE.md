# ERP Architecture Discovery

## Summary

**CRITICAL FINDING: No software ERP backend exists.**

The name "Compex ERP" refers to a set of Stitch design mockups (HTML + PNG files) representing a *desired future state* system. The current operational "ERP" is Microsoft Excel.

---

## Current State (as of 2026-08-10)

| Asset | Location | Type | Status |
|-------|----------|------|--------|
| `RFQLog (23).xlsx` | `D:\` | Excel RFQ tracker | ACTIVE — current ops |
| `KAS CRM.xlsx` | `D:\` | Excel CRM | ACTIVE — current ops |
| `stitch_compex_sourcing_procurement_platform/` | `D:\stitch_compex_sourcing_procurement_platform (1)\` | Stitch HTML mockups | DESIGN SPEC ONLY |
| `compex-frontend/` | `D:\stitch_compex_sourcing_procurement_platform (1)\` | Next.js 16.3.0 | FRONTEND — complete |

### Stitch Design Screens Found

| Screen | Path |
|--------|------|
| RFQ Management | `rfq_management_compex_erp/code.html` |
| RFQ Detail + BOM | `rfq_10452_bom_details_compex_erp/code.html` |
| Costing / Landed Cost | `costing_landed_cost_rfq_10452/code.html` |
| Vendor Management | `vendor_management_compex_erp/code.html` |
| Import & Logistics | `import_management_compex_erp/code.html` |

---

## What Does NOT Exist

| Component | Status |
|-----------|--------|
| Backend framework (.NET, Node, Python, etc.) | MISSING |
| Database server (SQL Server, PostgreSQL, etc.) | MISSING |
| Authentication system | MISSING |
| REST / GraphQL API | MISSING |
| Controllers / Services / Repositories | MISSING |
| Stored procedures | MISSING |
| Background jobs | MISSING |
| Email service | MISSING |
| File storage | MISSING |
| Audit logging | MISSING |
| Supplier API integrations (Mouser, DigiKey, element14) | MISSING |

---

## Architecture Recommendation

### Option A: Next.js → Existing ERP → SQL Server
**Not applicable.** There is no existing ERP backend to connect to.

### Option B: Next.js → New API Layer → Existing ERP → SQL Server
**Not applicable.** Same reason as A.

### Option C: Next.js → New Platform API → Platform DB (with optional future ERP sync)
**RECOMMENDED.** Since everything must be built from scratch, Option C is the correct framing — but simplified: there is no "existing ERP" to sync with. The Platform API IS the ERP.

---

## Recommended Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 16.3 (existing) | Already built, frozen |
| API | Node.js + Fastify or Next.js API Routes | Team is already in TS ecosystem |
| ORM | Prisma | Type-safe, excellent migration tooling |
| Database | PostgreSQL | Open-source, battle-tested, excellent JSON support |
| Auth | JWT + httpOnly cookies | Stateless, no session store needed initially |
| File storage | AWS S3 or Cloudflare R2 | BOM files, documents, invoices |
| Email | Resend or SendGrid | Transactional email |
| Background jobs | BullMQ (Redis) | Async BOM parsing, email, supplier lookups |

> **Note:** If the team has existing .NET expertise and prefers it, ASP.NET Core Web API + Entity Framework Core + PostgreSQL is a valid alternative to Node.js. The database schema and API contracts documented in `PLATFORM-API-SPEC.md` apply equally to either backend language.

---

## Backend Architecture Diagram

```
Browser / Mobile
      │
      ▼
Next.js 16.3 Frontend (PORT 3000)
      │
      │ HTTP / REST
      ▼
Platform API (PORT 4000)
  ├── Auth Service
  ├── Customer Service
  ├── RFQ Service
  ├── BOM Service
  ├── Vendor Service
  ├── Costing Service
  ├── Shipment Service
  ├── Invoice Service
  └── Admin Service
      │
      ├── PostgreSQL Database
      │     └── Row-Level Security (tenant isolation)
      │
      ├── Redis (sessions, BullMQ queues)
      │
      ├── S3 / R2 (documents, BOM files)
      │
      └── External APIs (Mouser, DigiKey, element14) [Phase 2]
```

---

## Implementation Phases

| Phase | Scope | Estimated Effort |
|-------|-------|-----------------|
| 1 | Auth, Customer registration/login, basic RFQ submission | 3–4 weeks |
| 2 | Admin RFQ management, BOM upload + parsing, Vendor management | 4–5 weeks |
| 3 | Costing (landed cost calculator), Customer quote delivery | 3–4 weeks |
| 4 | Orders, Purchase Orders, Shipment tracking | 4–5 weeks |
| 5 | Invoicing, Payments integration | 3–4 weeks |
| 6 | Supplier API integrations (Mouser, DigiKey, element14) | 4–6 weeks |
| 7 | Reporting, Analytics, Admin dashboard | 2–3 weeks |

Total estimated backend build: **23–31 weeks** (one developer)