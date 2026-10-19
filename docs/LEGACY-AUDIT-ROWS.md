# Legacy audit rows that may hold bank or credit values

Status: **report and recommendation only. No row was read from production, changed or deleted.** Production database access was not used; the queries below are for you (or a DBA) to run read-only.

## Exposure

Before Phase 5 (commit for F4), `audit()` stored whole `oldValue` / `newValue` objects. Organisation and company updates therefore wrote the fields below into `audit_logs.old_value` / `new_value` (JSONB). Since F4 a central filter (`redactAuditValue`, `compex-api/src/lib/audit.ts`) drops these keys, case-insensitively and at any depth, for every caller:

`bankDetails, bankName, bankAccount, bankAddress, swiftIfscMicr, routingCode, creditLimit, shippingAccount, internalAccountNumber, passwordHash, tokenHash`

Rows that can still contain them are those written by earlier versions with these actions: `organization.created`, `organization.updated` (entity `organization`), `company.updated` (customer portal), `customer.updated`, `customer.invited`, and vendor actions written before vendors stripped them locally.

Who can read them today: **no API route returns audit rows** (the only readers are two internal counts, in `auth.service.ts` for login throttling and `notification-recovery.ts`). The exposure is therefore database access, database backups and any export or BI tool pointed at `audit_logs`, not the website or admin UI.

## 1. Measure (read-only, run on production with a read-only role)

```sql
-- how many rows, by action, hold a sensitive key (any depth)
SELECT action, entity_type, count(*) AS rows_with_sensitive_keys,
       min(created_at) AS oldest, max(created_at) AS newest
FROM audit_logs
WHERE coalesce(old_value::text, '') || coalesce(new_value::text, '')
      ~* '"(bankDetails|bankName|bankAccount|bankAddress|swiftIfscMicr|routingCode|creditLimit|shippingAccount|internalAccountNumber|passwordHash|tokenHash)"\s*:'
GROUP BY action, entity_type
ORDER BY rows_with_sensitive_keys DESC;

-- total audit volume and age, for the retention decision
SELECT count(*) AS rows, min(created_at) AS oldest, pg_size_pretty(pg_total_relation_size('audit_logs')) AS size FROM audit_logs;
```

Report only counts and dates; do not copy row contents into tickets or chat.

## 2. Recommended remediation (needs your approval; nothing is run by this repo)

Keep the audit rows (who changed what, when) and remove only the sensitive values. Do it as a reviewed, one-off SQL script, not as an application migration, so it does not run automatically on a deploy:

1. Take a database backup or snapshot first, and note that older backups still contain the values until they expire.
2. Rehearse on a restored copy: run the scrub, re-run query 1, expect zero rows.
3. Run it in production inside a transaction with a row-count check:

```sql
-- PROPOSAL, NOT EXECUTED. Removes the listed keys at any depth; keeps every row.
CREATE OR REPLACE FUNCTION pg_temp.strip_sensitive(v jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE jsonb_typeof(v)
    WHEN 'object' THEN coalesce((
      SELECT jsonb_object_agg(k, pg_temp.strip_sensitive(val))
      FROM jsonb_each(v) AS e(k, val)
      WHERE lower(k) NOT IN ('bankdetails','bankname','bankaccount','bankaddress','swiftifscmicr','routingcode','creditlimit','shippingaccount','internalaccountnumber','passwordhash','tokenhash')
    ), '{}'::jsonb)
    WHEN 'array' THEN coalesce((SELECT jsonb_agg(pg_temp.strip_sensitive(x)) FROM jsonb_array_elements(v) AS a(x)), '[]'::jsonb)
    ELSE v END
$$;
BEGIN;
UPDATE audit_logs
SET old_value = pg_temp.strip_sensitive(old_value), new_value = pg_temp.strip_sensitive(new_value)
WHERE coalesce(old_value::text, '') || coalesce(new_value::text, '')
      ~* '"(bankDetails|bankName|bankAccount|bankAddress|swiftIfscMicr|routingCode|creditLimit|shippingAccount|internalAccountNumber|passwordHash|tokenHash)"\s*:';
-- check the reported row count equals query 1's total, then COMMIT (or ROLLBACK)
```

Note that `UPDATE` rewrites rows, so a `VACUUM` afterwards is advisable on a large table. The recursive function is the only part that needs care. This exact script was rehearsed on 2026-10-19 on a disposable Postgres with synthetic rows (nested object, array element, mixed-case key, a row with no sensitive keys): every row survived, all listed keys were removed at any depth, the other keys were kept, and query 1 then returned zero. It has not been run against production data; do the step 2 rehearsal on a restore of the real table first.

## 3. Retention (owner decision)

Nothing in the code ever purges `audit_logs`: it grows without bound and keeps whatever was written. Decide how long audit history must be kept (legal, customer-contract or internal policy). Once decided, a scheduled job can delete rows older than that; I have not chosen a period because none is documented. Until then the safe default is: keep everything, scrub the sensitive values (section 2), and restrict who has direct database or backup access.
