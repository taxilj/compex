# Platform API Specification

## Overview

All endpoints require HTTPS. JSON body for POST/PUT/PATCH. Errors return `{ error: string, code: string }`.

Base URL: `/api/v1`

Authentication: JWT in `Authorization: Bearer <token>` header, or httpOnly `access_token` cookie for browser clients.

---

## /api/v1/auth

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| POST | `/auth/register` | Customer self-registration | None | Public |
| POST | `/auth/login` | Email + password login | None | Public |
| POST | `/auth/logout` | Invalidate session | Required | Any |
| POST | `/auth/refresh` | Refresh access token | Refresh cookie | Any |
| POST | `/auth/forgot-password` | Send reset email | None | Public |
| POST | `/auth/reset-password` | Reset with token | None | Public |

### POST /auth/register
```json
// Request
{ "email": "user@company.com", "password": "...", "firstName": "...", "lastName": "...", "companyName": "...", "phone": "..." }

// Response 201
{ "message": "Registration successful. Please verify your email." }
```

### POST /auth/login
```json
// Request
{ "email": "...", "password": "..." }

// Response 200
{ "accessToken": "...", "expiresIn": 900, "user": { "id": "...", "email": "...", "role": "customer", "firstName": "..." } }
// Sets httpOnly cookie: access_token, refresh_token
```

---

## /api/v1/customers (Customer Portal)

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/customers/me` | Get own profile | Required | customer |
| PATCH | `/customers/me` | Update profile | Required | customer |
| GET | `/customers/me/company` | Get company details | Required | customer |
| PATCH | `/customers/me/company` | Update company | Required | customer |

---

## /api/v1/rfqs

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/rfqs` | List own RFQs | Required | customer |
| POST | `/rfqs` | Submit new RFQ | Required | customer |
| GET | `/rfqs/:id` | RFQ detail | Required | customer, staff |
| GET | `/rfqs/:id/items` | BOM line items | Required | customer, staff |
| POST | `/rfqs/:id/bom` | Upload BOM file | Required | customer |

### GET /rfqs (customer)
Returns only the authenticated customer's RFQs. Backend enforces `WHERE customer_id = :currentCustomerId`.

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "rfqNumber": "RFQ-10452",
      "status": "quote_ready",
      "priority": "high",
      "itemsCount": 12,
      "estimatedValueInr": 485000,
      "submittedAt": "2026-07-15T10:30:00Z",
      "requiredDate": "2026-08-30"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### POST /rfqs
```json
// Request
{ "notes": "...", "requiredDate": "2026-09-01", "deliveryLocation": "Mumbai" }
// Response 201 — returns rfq with id and rfqNumber
```

### POST /rfqs/:id/bom
- Content-Type: `multipart/form-data`
- Field: `bom` (file, max 10MB, XLSX/CSV only)
- Response 202: `{ "jobId": "...", "message": "BOM is being parsed" }`
- Background job parses and creates rfq_items

---

## /api/v1/quotes

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/quotes` | List own quotations | Required | customer |
| GET | `/quotes/:id` | Quotation detail | Required | customer, staff |
| GET | `/quotes/:id/items` | Line items | Required | customer, staff |
| POST | `/quotes/:id/accept` | Accept quotation | Required | customer |
| POST | `/quotes/:id/reject` | Reject quotation | Required | customer |
| GET | `/quotes/:id/download` | Download PDF | Required | customer |

**Security note:** Quote line items MUST NOT include `compex_margin_pct`, `landed_cost_inr`, or `vendor_quote_id`. Return `unit_price_inr` and `line_total_inr` only.

---

## /api/v1/orders

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/orders` | List own orders | Required | customer |
| GET | `/orders/:id` | Order detail | Required | customer, staff |
| GET | `/orders/:id/shipments` | Shipments for order | Required | customer |

---

## /api/v1/shipments

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/shipments` | List own shipments | Required | customer |
| GET | `/shipments/:id` | Shipment detail + tracking | Required | customer |

---

## /api/v1/invoices

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/invoices` | List own invoices | Required | customer |
| GET | `/invoices/:id` | Invoice detail | Required | customer |
| GET | `/invoices/:id/download` | Download PDF | Required | customer |

---

## /api/v1/products (Public Search)

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/products/search` | Search by MPN/keyword | None | Public |
| GET | `/products/:mpn` | Product detail | None | Public |

### GET /products/search?q=STM32F103&limit=10
```json
// Response 200
{
  "data": [
    { "mpn": "STM32F103C8T6", "manufacturer": "STMicroelectronics", "description": "MCU 32-bit 72MHz", "category": "MCU", "package": "LQFP-48", "lifecycleStatus": "active" }
  ]
}
```

---

## /api/v1/documents

| Method | Endpoint | Purpose | Auth | Role |
|--------|----------|---------|------|------|
| GET | `/documents/:id/download` | Signed download URL | Required | customer (own), staff |

**Security:** Returns a pre-signed S3/R2 URL valid for 60 seconds. Never returns the raw storage key.

---

## /api/v1/admin (Admin/Staff Only)

All routes require `role: admin OR staff`.

### Admin RFQs
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/rfqs` | All RFQs with filters |
| GET | `/admin/rfqs/:id` | Full RFQ detail (including internal costing) |
| PATCH | `/admin/rfqs/:id` | Update status, assign, set priority |
| GET | `/admin/rfqs/:id/items` | BOM items |
| PATCH | `/admin/rfqs/:id/items/:itemId` | Correct MPN/manufacturer |

### Admin Costing
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/rfqs/:id/vendor-rfqs` | Vendor enquiries sent |
| POST | `/admin/rfqs/:id/vendor-rfqs` | Send to vendor |
| POST | `/admin/rfqs/:id/vendor-rfqs/:vrId/quotes` | Record vendor quote |
| POST | `/admin/rfqs/:id/costing` | Calculate landed cost |
| POST | `/admin/rfqs/:id/quotation` | Generate customer quotation |

### Admin Vendors
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/vendors` | All vendors |
| POST | `/admin/vendors` | Add vendor |
| PATCH | `/admin/vendors/:id` | Update vendor |

### Admin Customers
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/customers` | All customers |
| GET | `/admin/customers/:id` | Customer detail + RFQ history |

### Admin Shipments
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/shipments` | All shipments |
| POST | `/admin/orders/:id/shipments` | Create shipment |
| PATCH | `/admin/shipments/:id` | Update status/tracking |

### Admin Invoices
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/admin/orders/:id/invoice` | Generate invoice |
| PATCH | `/admin/invoices/:id/paid` | Mark as paid |

---

## Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | VALIDATION_ERROR | Request body invalid |
| 401 | UNAUTHORIZED | No valid token |
| 403 | FORBIDDEN | Authenticated but wrong role or wrong customer |
| 404 | NOT_FOUND | Resource does not exist or is not visible to caller |
| 409 | CONFLICT | Duplicate (e.g., email already registered) |
| 422 | UNPROCESSABLE | Business logic violation (e.g., quotation expired) |
| 429 | RATE_LIMITED | Too many requests |
| 500 | SERVER_ERROR | Internal error |

**Note:** 404 is returned (not 403) when a customer tries to access another customer's resource — this prevents enumeration of other customers' IDs.