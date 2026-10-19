# Proxy chain and rate limits (F3)

Status: **prepared, not applied.** Nothing here has been changed on Render. Applying it needs owner approval and an ADMIN login to production.

## The problem

`render.yaml` sets `TRUST_PROXY_HOPS: "0"`, so Fastify ignores `X-Forwarded-For` and `req.ip` is the TCP peer. Behind Render that peer is a private balancer address (production logs show `10.x.x.x`). Every per-IP limit (200/min global, 5/min public enquiry POST, 10/min BOM upload, 60/min status) is therefore **one shared bucket for all visitors**: a handful of busy visitors can lock everyone else out of the enquiry form, and an abuser is limited only as part of that crowd.

The global limiter is written as `req.user?.id ?? req.ip`, but `@fastify/rate-limit` builds the key in `onRequest` and `authenticate` runs later in `preHandler`, so `req.user` is never set at that point. In practice every request is keyed by IP, signed in or not. (Locked in by the last test in `compex-api/test/unit/trust-proxy.test.ts`.)

## What is and is not known about Render's chain

Confirmed from Render's own pages (fetched 2026-10-19):

- Public web services receive traffic through Cloudflare and then Render's load balancers; the app sees a proxy address by default and Render says to read `X-Forwarded-For`.
- Cloudflare **overwrites** `CF-Connecting-IP` on public services (the header is absent on private services). Render also warns against taking the **left-most** `X-Forwarded-For` entry, because a caller can send their own copy and it stays to the left.

Not stated in any Render page I could read: how many entries `X-Forwarded-For` carries when it reaches the app. The expected shape is `<client>, <cloudflare edge>` with the private balancer as the TCP peer, which would mean **2** trusted hops. That is an assumption, not a fact, so the value must be measured before it is set. A count that is too low makes visitors share a Cloudflare address; a count above the real chain lets a caller choose its own IP (both shown in the unit tests).

## Measure it (read-only, no config change)

`GET /api/v1/admin/settings/client-ip` is ADMIN-only and echoes only the caller's own addresses. Call it once from the admin browser session, or with curl using an ADMIN access cookie, through the public API address:

```bash
curl -s -b "access_token=<ADMIN access token>" https://<public-api-host>/api/v1/admin/settings/client-ip
```

Read the result with the caller's own public IP (search "what is my IP") in hand:

| Field | Meaning |
|---|---|
| `socketAddress` | The TCP peer, expected to be a private Render address |
| `forwardedFor` | The raw `X-Forwarded-For` entries, left to right |
| `ips` / `ip` | What Fastify derives with the current `trustProxyHops` (0 now, so just the peer) |

Decision rule: write the chain right to left after the socket, `[socketAddress, forwardedFor[last], …, forwardedFor[0]]`. If your own IP sits at position **N** in that list (socket is position 0), set `TRUST_PROXY_HOPS=N`. For the expected shape `["<you>", "<cloudflare>"]` that is position 2, so `TRUST_PROXY_HOPS=2`.

Repeat the call once with a forged header to prove the spoof guard, using curl against production only with your own admin session:

```bash
curl -s -H "X-Forwarded-For: 1.2.3.4" -b "access_token=<ADMIN access token>" https://<public-api-host>/api/v1/admin/settings/client-ip
```

`forwardedFor` should show `1.2.3.4` as the **left-most** entry with your real IP still at position N. If the forged value appears at position N or to its right, stop and do not apply the setting.

## The change, once approved

Render dashboard, service `compex-api`, Environment: set `TRUST_PROXY_HOPS` to the value measured above (expected `2`) and save. That triggers a redeploy. `render.yaml` still says `"0"`; update it in the same release so a future blueprint sync does not revert the change:

```yaml
      - key: TRUST_PROXY_HOPS
        value: "2"   # only after the /client-ip measurement above
```

The schema allows 0 to 3 (`compex-api/src/config/env.ts`); no code change is needed.

## Verify after the change

1. Call `/api/v1/admin/settings/client-ip` again: `ip` must now equal your real public IP and `trustProxyHops` the new value.
2. With the forged `X-Forwarded-For` header, `ip` must still be your real IP.
3. Watch the Render request log: `remoteAddress` stays private, but the logged client IP should now vary by visitor.

## Roll back

Set `TRUST_PROXY_HOPS` back to `0` and redeploy. Behaviour returns exactly to today's.

## Regression tests (`compex-api/test/unit/trust-proxy.test.ts`)

Run with Fastify `inject` and no network. They show, for hops 0/1/2/3: visitors share one bucket at 0; get distinct IPs and buckets at the right count; a caller-supplied `X-Forwarded-For` cannot change the IP at the right count; a count that is too low mistakes the Cloudflare edge for the client; a count that is too high lets a caller choose its IP; and signed-in users are still keyed by IP in the real hook order.

## Sources

- https://render.com/articles/how-render-handles-ddos-attacks
- https://render.com/articles/host-pocketbase-on-render
- https://community.render.com/t/accessing-client-ips-in-a-node-express-app/36282 (not re-readable on 2026-10-19; the host redirected to a name that did not resolve, so it is not relied on)

## Out of scope

Keying the global limiter on the authenticated user (needs the limiter to run after `authenticate`) was not changed: it would alter limits for signed-in users and has no owner requirement behind it.
