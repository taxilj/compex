# Supplier Integrations

## Current Status: ALL MISSING

No supplier API integrations exist anywhere in the repository. The frontend UI references sourcing from Mouser, DigiKey, and element14, but there is no backend implementation.

---

## Mouser Electronics

**Status: NOT IMPLEMENTED**

| Aspect | Current State | Required |
|--------|-------------|---------|
| API client | MISSING | Yes |
| Authentication | MISSING | Mouser API key (per-account, free registration) |
| Product search by MPN | MISSING | `GET /api/v1/search/partnumber` |
| Pricing & stock | MISSING | Included in search response |
| Lead time | MISSING | `NextGenLeadTime` field in response |
| Manufacturer mapping | MISSING | `ManufacturerName` field |
| Error handling | MISSING | |
| DB persistence | MISSING | Store in `vendor_quotes` with `vendor_id` = Mouser |
| Config required | — | `MOUSER_API_KEY` environment variable |

### API Notes
- Base URL: `https://api.mouser.com/api/v1`
- Auth: `apiKey` query parameter (NEVER hardcode — use env var)
- Rate limit: UNKNOWN — requires testing after account setup
- Response includes: MPN, manufacturer, description, stock qty, price breaks, lead time

### Integration Plan (Phase 2)
```
Staff clicks "Search Mouser" on RFQ item
→ API: POST /api/rfqs/{id}/items/{itemId}/source/mouser
→ Backend calls Mouser API with item MPN
→ Response stored as vendor_quote rows (vendor = "Mouser")
→ Staff selects best price break quantity
```

---

## DigiKey

**Status: NOT IMPLEMENTED**

| Aspect | Current State | Required |
|--------|-------------|---------|
| API client | MISSING | Yes |
| Authentication | MISSING | OAuth 2.0 client credentials (DigiKey Developer Portal) |
| Product search | MISSING | `POST /products/v4/search/keyword` or `/products/v4/search/partnumber` |
| Pricing & stock | MISSING | Included in product response |
| Lead time | MISSING | `QuantityAvailable` + `BackOrderDetails` |
| Error handling | MISSING | |
| DB persistence | MISSING | Store in `vendor_quotes` with `vendor_id` = DigiKey |
| Config required | — | `DIGIKEY_CLIENT_ID`, `DIGIKEY_CLIENT_SECRET` env vars |

### API Notes
- Base URL: `https://api.digikey.com`
- Auth: OAuth 2.0 (client credentials grant) — token must be refreshed
- Token endpoint: `https://api.digikey.com/v1/oauth2/token`
- Rate limit: UNKNOWN — requires DigiKey developer account to verify
- Pricing is currency-specific; request INR or USD explicitly

### Integration Plan (Phase 2)
```
Staff clicks "Search DigiKey" on RFQ item
→ Backend obtains/refreshes OAuth token (cached in Redis, TTL = expires_in - 60s)
→ Backend calls DigiKey product search
→ Response stored as vendor_quote rows (vendor = "DigiKey")
→ Staff selects best option
```

---

## element14 (Farnell / Avnet)

**Status: NOT IMPLEMENTED**

| Aspect | Current State | Required |
|--------|-------------|---------|
| API client | MISSING | Yes |
| Authentication | MISSING | element14 API key (developer.element14.com) |
| Product search | MISSING | `GET /catalog/products` with `callInfo.apiKey` |
| Pricing | MISSING | `prices` array in response |
| Stock | MISSING | `stock.level` field |
| Lead time | MISSING | `stock.leastLeadTime` field |
| Error handling | MISSING | |
| DB persistence | MISSING | Store in `vendor_quotes` |
| Config required | — | `ELEMENT14_API_KEY` env var |

### API Notes
- Base URL: `https://api.element14.com/catalog/products`
- Auth: `callInfo.apiKey` parameter
- Response format: JSON or XML (request JSON)
- Supports India (in.element14.com) — use correct regional endpoint

### Integration Plan (Phase 2)
```
Staff clicks "Search element14" on RFQ item
→ Backend calls element14 catalog API with MPN
→ Response stored as vendor_quote rows
→ Staff selects option
```

---

## Integration Architecture (Phase 2)

All three integrations follow the same pattern:

```
SupplierSearchService (abstract)
├── MouserSearchService
├── DigiKeySearchService
└── Element14SearchService

Each service:
  - fetchByMPN(mpn: string): Promise<SupplierQuote[]>
  - Normalizes response to SupplierQuote interface
  - Stores results in vendor_quotes table
  - Handles rate limiting with exponential backoff
  - Caches MPN lookups in Redis (TTL: 4 hours)
```

### SupplierQuote (normalized interface)
```typescript
interface SupplierQuote {
  supplier: 'mouser' | 'digikey' | 'element14'
  mpn: string
  manufacturer: string
  description: string
  stockQty: number
  leadTimeDays: number | null
  pricingBreaks: Array<{ moq: number; unitPriceUsd: number }>
  currency: 'USD'
  fetchedAt: Date
}
```

---

## Security Requirements for Supplier Integrations

- API keys stored in environment variables only — never in code or database
- OAuth tokens (DigiKey) stored in Redis with TTL matching `expires_in`
- All outbound API calls go through a single HTTP client with logging
- Failed supplier calls are retried max 3 times with exponential backoff
- Supplier API errors must NOT bubble up to customer-facing API responses
- Rate limit errors (429) must be caught and staff-notified, not customer-notified