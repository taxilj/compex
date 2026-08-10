# Authentication Architecture

## Existing ERP Authentication

**MISSING — no authentication system exists.** The current Excel-based workflow has no authentication. Everything must be built from scratch.

---

## User Roles

| Role | Description | Access |
|------|-------------|--------|
| `customer` | External company buying components | Portal only: own RFQs, quotes, orders, shipments, invoices |
| `staff` | Internal Compex procurement staff | Admin ERP: all customers, all RFQs, vendor management, costing |
| `admin` | Super admin / operations lead | Everything: staff management, config, reports |

Vendor self-service is out of scope for Phase 1. Vendors are managed internally by staff.

---

## Recommendation: Separate Auth System (JWT + httpOnly Cookies)

### Why not Existing Auth?
There is no existing auth. Starting fresh.

### Why not SSO (Google/Azure/Okta)?
- Customer base is B2B companies across India; many will not have Google Workspace or Azure AD
- SSO increases complexity and external dependency
- Over-engineered for Phase 1 of a greenfield platform
- Can be added in Phase 2 for admin/staff if the team moves to Google Workspace

### Why not Sessions?
- Sessions require a session store (Redis); JWTs are stateless
- BUT: JWTs cannot be invalidated mid-session — mitigated by short expiry + refresh token pattern

### Recommended: JWT + Refresh Token

**Access Token**
- JWT, signed with HS256 (or RS256 if future microservices)
- Payload: `{ sub: userId, role: 'customer'|'staff'|'admin', customerId?: uuid, iat, exp }`
- Expiry: **15 minutes**
- Sent in: `Authorization: Bearer <token>` header (for API) OR httpOnly cookie (for browser portal)

**Refresh Token**
- Opaque random token (32 bytes hex), stored in database table `refresh_tokens`
- Expiry: **30 days**
- Stored in httpOnly, Secure, SameSite=Strict cookie
- Rotated on each use (refresh token rotation)
- Invalidated on logout

**Token Storage for Browser Clients (Portal)**
```
access_token  → httpOnly cookie, Secure, SameSite=Strict, Path=/, Max-Age=900
refresh_token → httpOnly cookie, Secure, SameSite=Strict, Path=/api/v1/auth/refresh, Max-Age=2592000
```
Never store tokens in localStorage — vulnerable to XSS.

---

## refresh_tokens Table

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 of raw token
  family TEXT NOT NULL,             -- for rotation detection
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ            -- set on logout or rotation
);
```

Refresh token rotation with family tracking prevents token reuse attacks: if a revoked token in a family is presented, ALL tokens in that family are revoked (session hijack detection).

---

## Authentication Flow

### Customer Registration
```
1. POST /api/v1/auth/register { email, password, firstName, lastName, companyName }
2. Backend: create users row (role=customer), create companies row, create customers row
3. Send email verification link (token stored in email_verifications table, expires 24h)
4. Response: 201 { message: "Check your email to verify your account" }
```

### Login
```
1. POST /api/v1/auth/login { email, password }
2. Backend: fetch user by email, bcrypt.compare(password, passwordHash)
3. If invalid: 401 { error: "Invalid credentials" } — same message for wrong email OR wrong password (prevents enumeration)
4. If unverified: 403 { error: "Email not verified", code: "EMAIL_NOT_VERIFIED" }
5. If valid: generate accessToken + refreshToken
6. Set httpOnly cookies, return { accessToken, expiresIn, user: { id, email, role, firstName } }
```

### Token Refresh
```
1. POST /api/v1/auth/refresh (no body — reads refresh_token cookie)
2. Backend: verify refresh token, check not revoked, check not expired
3. Rotate: revoke old token, issue new access + refresh tokens
4. If reuse detected (revoked token presented): revoke entire family, return 401
```

### Logout
```
1. POST /api/v1/auth/logout
2. Backend: revoke current refresh token family
3. Clear cookies
4. Return 200
```

---

## Authorization (Middleware)

Every protected route runs two checks:

1. **Authentication check**: Verify JWT signature + expiry → get `userId`, `role`, `customerId`
2. **Authorization check**: Role-based gate + ownership gate

```typescript
// Pseudo-code for customer-scoped route
async function requireCustomerOwnership(req, rfqId) {
  const rfq = await db.rfqs.findById(rfqId)
  if (!rfq) throw new NotFoundError()  // NOT ForbiddenError — prevent enumeration
  if (rfq.customerId !== req.user.customerId) throw new NotFoundError()
  return rfq
}
```

The ownership check throws `NotFoundError` (404), never `ForbiddenError` (403), when a customer requests another customer's resource. This prevents enumeration.

---

## Password Security

- Hash algorithm: **bcrypt**, work factor 12
- Minimum password length: 10 characters
- Enforce: at least one uppercase, one number (configurable)
- Rate limiting on login: 5 failed attempts → 15-minute lockout (stored in Redis)
- Password reset: 6-character OTP emailed, expires in 10 minutes; OR signed URL with 1-hour expiry

---

## Future: Admin SSO (Phase 2+)

If the team adopts Google Workspace internally, add Google OAuth for staff/admin login:
- OIDC flow via `@auth/core` or Passport.js
- Map Google email domain to `staff` role
- Keep password login as fallback for service accounts
- Customer login always stays password-based (no Google SSO for external customers)