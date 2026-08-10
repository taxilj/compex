# Security Architecture

## Threat Model

Compex Solution is a B2B procurement portal handling:
- Customer company financial data (quotes, invoices, pricing)
- Supplier relationships and pricing (commercially sensitive)
- Import/customs documentation
- Internal margin data (must never reach customers)

Primary threats:
1. **Tenant crossover** — Customer A accessing Customer B's data
2. **Margin leakage** — Internal markup visible to customers
3. **Credential theft** — Stolen customer login
4. **BOM file attacks** — Malicious XLSX/CSV payloads
5. **API enumeration** — Discovering other customers' IDs
6. **Admin impersonation** — Staff credentials compromised
7. **Supply chain** — Malicious npm packages

---

## 1. Tenant Data Isolation

This is the most critical security requirement.

### Defense in Depth (3 layers)

**Layer 1: Application code**
```typescript
// Every query that touches customer data must include customer_id filter
const rfqs = await db.rfqs.findMany({
  where: { customerId: req.user.customerId }  // always
})
```

**Layer 2: PostgreSQL Row-Level Security (RLS)**
```sql
-- Set per-request before any query
SET LOCAL app.customer_id = '<uuid from JWT>';
SET LOCAL app.role = 'customer';

-- Policy enforces at DB level even if app code is wrong
CREATE POLICY customer_isolation ON rfqs
  FOR ALL
  USING (
    current_setting('app.role') IN ('admin', 'staff')
    OR customer_id = current_setting('app.customer_id')::uuid
  );
```

**Layer 3: Return 404 (not 403) for cross-tenant access**
When a customer requests another customer's resource, return 404 — not 403. A 403 confirms the resource exists. A 404 reveals nothing.

### Tables requiring RLS
`rfqs`, `rfq_items`, `quotations`, `quotation_items`, `sales_orders`, `shipments`, `invoices`, `documents`

---

## 2. Internal Margin Protection

Compex's profit margins must NEVER appear in any API response to customers.

| Field | Table | Action |
|-------|-------|--------|
| `compex_margin_pct` | `costings` | Never select in customer-facing queries |
| `landed_cost_inr` | `costings` | Never expose to customer API |
| `vendor_quote_id` | `quotation_items` | Never expose (reveals vendor pricing) |
| `unit_price_usd` (vendor) | `vendor_quotes` | Internal only |

**Enforcement approach:**
- Separate DTO types: `CustomerQuoteItem` vs `InternalQuoteItem`
- TypeScript return types enforce that internal fields cannot leak through customer routes
- Integration tests verify customer-facing endpoints never return these fields

---

## 3. Authentication Security

See `AUTH-ARCHITECTURE.md` for full details. Security-critical points:

- Tokens in httpOnly cookies only (never localStorage)
- Refresh token rotation with family tracking
- Login rate limiting: 5 attempts → 15-min lockout (Redis)
- bcrypt cost factor 12 for password hashing
- Email verification required before first login
- Password reset tokens single-use, expire in 10 minutes

---

## 4. API Security

### HTTPS Only
- Redirect all HTTP to HTTPS
- HSTS header: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

### CORS
```typescript
cors({
  origin: ['https://compexsolution.com', 'https://www.compexsolution.com'],
  credentials: true,  // required for httpOnly cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
})
```
Never use `origin: '*'` — credentials + wildcard is rejected by browsers anyway but indicates misunderstanding.

### Security Headers
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{RANDOM}'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| POST /auth/login | 5/15min per IP |
| POST /auth/register | 10/hour per IP |
| POST /auth/forgot-password | 3/hour per email |
| GET /products/search | 60/min per IP |
| POST /rfqs/:id/bom | 10/hour per customer |
| All other API | 200/min per authenticated user |

### Input Validation
- All request bodies validated against strict JSON schema (Zod or Joi)
- Unknown fields stripped (no passthrough)
- String fields: max length enforced
- Numeric fields: min/max enforced
- File uploads: MIME type + file extension checked (both, not just extension)

### SQL Injection Prevention
- All DB queries through Prisma ORM — parameterized queries only
- Never interpolate user input into raw SQL strings
- If raw SQL needed: use `$queryRaw` with tagged template literals (Prisma handles parameterization)

### XSS Prevention
- React/Next.js auto-escapes JSX — no `dangerouslySetInnerHTML`
- API responses are JSON — no HTML rendering of user data on server
- Customer-provided strings (company names, notes) sanitized before PDF generation

---

## 5. File Upload Security

### BOM Files (XLSX/CSV)
- Max size: 10MB
- Allowed MIME types: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/csv`
- File extension must match MIME type
- Parsing done in sandboxed background worker (not in web process)
- XLSX parsed with `xlsx` library — macro execution disabled
- No executable content allowed
- Malformed files: parse error returned to staff, not retried indefinitely

### Documents (Invoices, Packing Lists, etc.)
- Max size: 25MB per file
- Allowed types: `application/pdf`, `image/jpeg`, `image/png`
- Stored with randomized key in S3/R2 — original filename only stored in DB
- Download via signed URL (60 second expiry) — never direct S3 public URL

### Virus Scanning
- Phase 1: Hash check against VirusTotal API (free tier: 4 req/min) for high-risk uploads
- Phase 2: ClamAV on upload server OR AWS Security Hub malware scan

---

## 6. Secret Management

| Secret | Storage |
|--------|---------|
| JWT signing key | Environment variable (`JWT_SECRET`, min 256 bits) |
| Database URL | Environment variable (`DATABASE_URL`) — never in code |
| Redis URL | Environment variable (`REDIS_URL`) |
| S3/R2 credentials | Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) or IAM role |
| Mouser API key | Environment variable (`MOUSER_API_KEY`) |
| DigiKey client ID/secret | Environment variables |
| element14 API key | Environment variable (`ELEMENT14_API_KEY`) |
| Email service key | Environment variable (`EMAIL_API_KEY`) |
| Stripe/payment key | Environment variable (`PAYMENT_SECRET_KEY`) |

**Rules:**
- Rotate all secrets if any team member leaves
- Use `.env.local` locally; never commit `.env` files
- Production secrets managed via hosting platform (Vercel env vars, Railway, AWS Secrets Manager)
- Audit log all admin actions — if a secret leaks, the audit trail shows what was accessed

---

## 7. Audit Logging

Every state-changing action logged to `audit_logs` table:
- Who (user ID, role, IP)
- What (action code: `rfq.status_changed`, `quotation.sent`, `invoice.paid`)
- Entity (type + ID)
- Before/after state (JSONB)

Audit logs are:
- Append-only (no updates, no deletes — staff cannot modify them)
- Retained for minimum 7 years (compliance)
- Accessible to admin role only

---

## 8. Known Risks and Mitigations

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Customer A accesses Customer B's RFQ | CRITICAL | RLS + app-level filtering + 404 not 403 |
| Internal margin exposed in API | CRITICAL | Separate DTOs + integration tests |
| BOM file with macro/formula injection | HIGH | Disable macros in xlsx parser; sandbox worker |
| Credential stuffing on login | HIGH | Rate limiting + lockout + breach password check (HaveIBeenPwned API) |
| JWT token stolen via XSS | HIGH | httpOnly cookies + CSP |
| Refresh token reuse | HIGH | Token rotation + family revocation |
| Admin account compromise | HIGH | Enforce strong passwords + future MFA |
| Supplier API key leaked | HIGH | Env vars only; rotate immediately if exposed |
| S3 bucket public read | HIGH | Private bucket only; signed URLs |
| Overly permissive CORS | MEDIUM | Strict origin whitelist |
| API enumeration (other customers) | MEDIUM | Return 404 not 403 for cross-tenant access |
| Log injection | LOW | Sanitize user strings before logging |