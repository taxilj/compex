# Admin route authorisation (F5)

Status: **current behaviour audited and locked in by tests; one rule changed on 2026-10-20: the enquiry CSV export is now ADMIN-only.** The owner's documents do not define what a generic STAFF user may do, so the decision was asked rather than invented (see "Approved policy" at the end).

## How access is enforced

Every route under `/api/v1/admin/*` (75 routes in 14 routers) registers `authenticate` then `requireRole("STAFF", "ADMIN")` as router-wide `preHandler` hooks. `authenticate` re-reads the user's **role and status from the database on every request** (Phase 5 F1), so a demoted or suspended account loses access immediately. A router that forgot the hooks would be an open door, so the test below enumerates the routes of the running app instead of trusting this list.

## What differs between STAFF and ADMIN today

| Where | Rule |
|---|---|
| `GET /admin/settings/client-ip` | ADMIN only (route-level `requireRole("ADMIN")`) |
| `GET /admin/leads/export` (enquiry CSV) | ADMIN only (route-level `requireRole("ADMIN")`, owner policy 2026-10-20); the Enquiries page shows the Export CSV link to ADMIN only |
| `POST /admin/users` | creating an account with role ADMIN needs an ADMIN caller; STAFF may invite STAFF or CUSTOMER accounts |
| `PATCH /admin/users/:id` | editing or suspending an account whose role is ADMIN needs an ADMIN caller; role itself cannot be changed through this route |
| Everything else under `/admin/*` | identical for STAFF and ADMIN |

## Routers (all STAFF + ADMIN unless noted above)

| Router | Routes |
|---|---|
| `rfqs` | list, get, set status, set sourcing status |
| `leads` | list, get, create, update, **CSV export**, convert to RFQ |
| `quotations` | list, get, create, create from sourcing, update, **send to customer**, PDF |
| `vendor-rfqs` | list, get, create, record quote, update quote, **send** (+ `landed-cost` get/create/update) |
| `customers` | list, get, create (sends invitation), update (includes credit limit, bank details, account numbers) |
| `vendors` | list, get, create, update, activate, deactivate |
| `manufacturers` | list, get, create, update, activate, deactivate |
| `products` | list, get, history, create, update |
| `categories` | list, create, update |
| `catalog-import` | **CSV upload**, **Mouser / Element14 / DigiKey fetches** (consume paid supplier API quota), import runs, coverage |
| `organizations` | list, get, create, update (includes bank details and document-number prefixes) |
| `settings` | list, categories, create, update, activate, deactivate, **delete**; `client-ip` ADMIN only |
| `users` | list, get, invite, update (see rules above) |

Other authenticated areas are not `/admin`: customer-portal routes (`/customers`, `/rfqs`, `/quotes`, `/documents`) scope every query to the caller's own company; `documents/:id/download` additionally lets STAFF and ADMIN fetch any document. Public routes (`/auth`, `/leads`, `/products`, `/manufacturers`, `/categories`) are unauthenticated by design.

## Tests

`compex-api/test/unit/admin-authorization.test.ts` boots the real app, captures every `/api/v1/admin/*` route through Fastify's `fastify.initialization` diagnostics channel, replaces the handlers with stubs (no database, supplier API or Redis is touched) and asserts, with the real guards:

- no token: 401 on every admin route;
- CUSTOMER token: 403 on every admin route;
- STAFF token: 200 on every admin route except the `ADMIN_ONLY` set (currently `client-ip` and `leads/export`, which must be 403);
- ADMIN token: 200 on every admin route;
- a valid token for a SUSPENDED account: 401.

Adding an admin route without guards fails the 401/403 tests; narrowing a router to ADMIN fails the STAFF test (checked by temporarily narrowing the vendor router: all six vendor routes were reported). Field-level rules (ADMIN accounts in `users`) have their own tests (`admin-users-suspend.test.ts`, `admin-master-security.test.ts`).

## What the owner's documents say

`KAS CRM.xlsx`, sheet **INDEX**:

- Department list (for permission level only): Sales, Sourcing, Account, Logistic, Admin.
- A matrix that gives each *department* an EDIT/ADD list and a VIEW list: Super Admin = all; Sales = Customer and RFQ Log (new RFQ add only) to edit, RFQ Log / L1-Price / Manufacturer / User to view; Purchase = Customer, Vendor, RVL, L1-Price, Manufacturer, DPASL, Product; Account = Customer, Vendor, L1-Price, Manufacturer, DPASL; Sourcing = RFQ Log, Vendor, RVL, Product, Manufacturer to edit, Customer / L1-Price to view.
- Import/export of Customer, Vendor, RVL and Enquiry data "as per format and roles to only admin".

`docs/OWNER-MASTER-DATA-COMPLIANCE.md` records that no permission system should be invented without sign-off on what department-based access should restrict. The application has three roles (CUSTOMER, STAFF, ADMIN) and a free-text-validated `department` field on users that nothing reads; the matrix above is by department and uses names (RVL, DPASL, L1-Price) that have no admin screens here. It therefore cannot be applied to the existing STAFF role without choices only the owner can make.

## Approved policy (decided 2026-10-19, export rule stated 2026-10-20)

**Question:** what may a STAFF user do? **Decision: STAFF stays broadly equivalent to ADMIN**, with three exceptions: STAFF cannot create or edit ADMIN accounts, cannot use the `client-ip` diagnostic, and cannot export data (the enquiry CSV export is ADMIN-only). This is a convenience policy, **not a least-privilege model**: STAFF can still, knowingly, upload catalogue CSVs, trigger paid supplier API fetches, edit organisation bank details, edit customer credit limits and bank details, delete dropdown values, and invite or suspend STAFF and CUSTOMER users.

History: on 2026-10-19 the owner chose "keep as is", which at that time let STAFF export. On 2026-10-20 the owner's written policy listed exports as ADMIN-only ("Exports remain ADMIN-only"), so the export route was restricted and the earlier note corrected. The catalogue CSV upload and the quotation PDF are not exports in this sense and were left unchanged; say so if they should be restricted too.

`test/unit/admin-authorization.test.ts` enforces this policy: its `ADMIN_ONLY` set (client-ip and leads export) is the single place that changes if the owner restricts more. Not chosen: making catalogue import ADMIN-only per the INDEX sheet wording, and the department matrix; either can be revisited when the owner defines how departments map to the STAFF role.
