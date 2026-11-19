# Frontend validation follow-up — 19 November 2026

## Scope

The owner requested frontend completion and QA while database/ERPNext answers are pending. This follow-up changes only two frontend forms, their tests and documentation. Existing data, backend source, credentials, dependencies and deployment configuration are retained.

## Fixes

- Portal RFQ: retain every entered component row. Missing part numbers, fractional/nonpositive/out-of-range quantities and negative/nonfinite target prices are rejected before a draft is created. Entirely untouched optional rows are ignored.
- Use `Number` consistently for validated numeric input. Previously quantity `1e3` passed validation as 1000 but `parseInt` sent 1; target price `1e2` was similarly truncated to 1. The corrected payload contains quantity 1000 and target price 100. Zero price and omitted price remain distinct.
- Contact: ignore repeat form submissions while a request is pending. Failure retains entered content and the idempotency key; success is shown only after an accepted response.

## Validation

- Before the fixes: five failing regression cases reproduced the defects; eleven other focused cases passed.
- After the fixes: all 16 focused cases and all 245 frontend tests pass, with no skipped tests.
- Production build and TypeScript check pass. Lint passes with three existing warnings in CategorySection, AuthContext and the API client. Those unrelated behaviors were not changed merely to suppress warnings.
- One existing vendor test timed out during the first full run alongside the build. Its isolated recheck and the final full suite passed without changing that test or increasing timeouts. Both runs are retained as evidence.
- Local production-build browser checks used intercepted synthetic API responses. Contact: one in-flight request despite repeat submit, preserved content/key on retry, safe failure text and accepted-reference success. Portal: invalid partial/price input creates no draft; correcting it creates one draft, sends the exact numeric values and submits once; a blank extra row is ignored.
- Twelve responsive checks passed across Home, Contact, Request Quote and New RFQ at 390, 768 and 1440 pixels: one H1, HTTP 200, no page exceptions and no horizontal overflow. A simulated catalogue outage shows the unavailable/retry state without displaying the private test error.

## Preservation and limits

All six existing environment-file hashes match the pre-consolidation baseline. No database was started, queried, seeded, migrated or reset for this follow-up; no production form, supplier or mail request was sent. The task-owned loopback frontend runtime, synthetic cookie and browser tab were cleaned up. Private logs and test JSON are under ignored `.local-recovery/2026-11-19-frontend-followup/`.

These checks establish frontend behavior with controlled responses. Production catalogue/enquiry/database connectivity and ERPNext integration remain dependent on the owner's pending answers; they are not represented as repaired or verified here. Deployment evidence is separate from local QA.
