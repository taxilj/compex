import { env } from "../../../config/env.js";
import { Errors } from "../../../lib/errors.js";
import { withTimeout, TimeoutError } from "../../../lib/async.js";

// Server-only Nexar Supply API client. Never import this from anything that
// could end up in a frontend bundle -- it is only ever used from
// nexar-fetcher.ts, which runs inside the API process.
//
// Official endpoints (Phase 2):
//   Token:    https://identity.nexar.com/connect/token   (OAuth2 client credentials)
//   GraphQL:  https://api.nexar.com/graphql
const NEXAR_TOKEN_URL = "https://identity.nexar.com/connect/token";
const NEXAR_GRAPHQL_URL = "https://api.nexar.com/graphql";

const TOKEN_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 15_000;
const MAX_TRANSIENT_RETRIES = 2; // network/5xx/429 only -- never for 401/403

interface NexarTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

// Module-level token cache, same shape/reasoning as digikey-fetcher.ts's
// cachedToken: a client-credentials token is valid for the whole process
// (Nexar documents a 24h lifetime), not per-request, so refetching on every
// lookup would be wasteful and slower for no benefit. Cleared implicitly on
// process restart. Never logged, never returned to any caller outside this
// module.
let cachedToken: CachedToken | null = null;
let tokenRequestInFlight: Promise<string> | null = null;

export function isNexarConfigured(): boolean {
  return Boolean(env.NEXAR_CLIENT_ID && env.NEXAR_CLIENT_SECRET);
}

// Client-credentials token fetch, cached until shortly before expiry
// (Phase 3, steps 1-2). Concurrent callers during a cold cache share one
// in-flight request instead of firing N token requests at once.
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 10_000) return cachedToken.value;

  if (!tokenRequestInFlight) {
    tokenRequestInFlight = (async () => {
      try {
        // Nexar documents a fixed 24h token lifetime rather than returning
        // Nexar-specific expires_in guidance beyond the generic OAuth2
        // field, so trust expires_in when present and otherwise assume the
        // documented 24h (cap defensively at 24h either way).
        const before = Date.now();
        const token = await requestNewTokenWithExpiry();
        cachedToken = token;
        return token.value;
      } finally {
        tokenRequestInFlight = null;
      }
    })();
  }
  return tokenRequestInFlight;
}

async function requestNewTokenWithExpiry(): Promise<CachedToken> {
  if (!env.NEXAR_CLIENT_ID || !env.NEXAR_CLIENT_SECRET) {
    throw Errors.serviceUnavailable(
      "NEXAR_CLIENT_ID / NEXAR_CLIENT_SECRET are not configured. Create a Supply application at https://portal.nexar.com, grant it the supply.domain scope, and set both in the server environment.",
    );
  }

  let res: Response;
  try {
    res = await withTimeout(
      fetch(NEXAR_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: env.NEXAR_CLIENT_ID,
          client_secret: env.NEXAR_CLIENT_SECRET,
          scope: env.NEXAR_SCOPE,
        }),
      }),
      TOKEN_TIMEOUT_MS,
      "Nexar OAuth token request",
    );
  } catch (err) {
    if (err instanceof TimeoutError) throw Errors.serviceUnavailable("Nexar OAuth token request timed out");
    throw Errors.serviceUnavailable(`Nexar OAuth token request failed: ${err instanceof Error ? err.message : "network error"}`);
  }

  const body = (await res.json().catch(() => ({}))) as NexarTokenResponse;

  if (res.status === 401 || res.status === 403) {
    throw Errors.serviceUnavailable("Nexar OAuth authentication failed: invalid NEXAR_CLIENT_ID/NEXAR_CLIENT_SECRET or the app is missing the supply.domain scope");
  }
  if (!res.ok || !body.access_token) {
    throw Errors.serviceUnavailable(`Nexar OAuth token request failed: ${body.error_description ?? body.error ?? res.status}`);
  }

  const MAX_LIFETIME_SECONDS = 24 * 60 * 60;
  const lifetimeSeconds = body.expires_in && body.expires_in > 0 ? Math.min(body.expires_in, MAX_LIFETIME_SECONDS) : MAX_LIFETIME_SECONDS;
  return { value: body.access_token, expiresAt: Date.now() + lifetimeSeconds * 1000 };
}

export interface NexarGraphQLError {
  message: string;
  extensions?: { code?: string };
}

interface NexarGraphQLResponse<T> {
  data?: T;
  errors?: NexarGraphQLError[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One authenticated GraphQL request against api.nexar.com, with:
//  - a hard request timeout (Phase 3, step 6)
//  - bounded retry/backoff for transient failures only -- network errors,
//    5xx, and 429 rate-limiting (Phase 3, step 7)
//  - NO retry for authentication failures, so a bad/revoked credential
//    fails fast instead of looping (Phase 3, step 8)
//  - GraphQL-level errors (query executed, but Nexar returned `errors`)
//    surfaced distinctly from transport failures, since these are not
//    retryable (Phase 3, step 5: "GraphQL errors")
export async function nexarGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  if (!isNexarConfigured()) {
    throw Errors.serviceUnavailable(
      "NEXAR_CLIENT_ID / NEXAR_CLIENT_SECRET are not configured. Create a Supply application at https://portal.nexar.com, grant it the supply.domain scope, and set both in the server environment.",
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSIENT_RETRIES + 1; attempt++) {
    const token = await getAccessToken();

    let res: Response;
    try {
      res = await withTimeout(
        fetch(NEXAR_GRAPHQL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query, variables }),
        }),
        QUERY_TIMEOUT_MS,
        "Nexar GraphQL request",
      );
    } catch (err) {
      lastError = err instanceof TimeoutError ? Errors.serviceUnavailable("Nexar GraphQL request timed out") : err;
      if (attempt <= MAX_TRANSIENT_RETRIES) {
        await sleep(2 ** attempt * 250);
        continue;
      }
      throw lastError instanceof Error ? Errors.serviceUnavailable(`Nexar GraphQL request failed: ${lastError.message}`) : Errors.serviceUnavailable("Nexar GraphQL request failed");
    }

    if (res.status === 401 || res.status === 403) {
      // Token may have been invalidated server-side (revoked app, scope
      // change) between calls -- drop the cache once so the *next* request
      // gets a fresh token, but never retry within this call: an
      // authentication failure is not transient by definition here.
      cachedToken = null;
      throw Errors.serviceUnavailable("Nexar API rejected the request as unauthenticated (401/403). Check NEXAR_CLIENT_ID/NEXAR_CLIENT_SECRET and the supply.domain scope.");
    }

    if (res.status === 429) {
      if (attempt <= MAX_TRANSIENT_RETRIES) {
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 500;
        await sleep(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 2 ** attempt * 500);
        continue;
      }
      throw Errors.rateLimited();
    }

    if (res.status >= 500) {
      lastError = Errors.serviceUnavailable(`Nexar API request failed with status ${res.status}`);
      if (attempt <= MAX_TRANSIENT_RETRIES) {
        await sleep(2 ** attempt * 250);
        continue;
      }
      throw lastError;
    }

    if (!res.ok) {
      throw Errors.serviceUnavailable(`Nexar API request failed with status ${res.status}`);
    }

    const body = (await res.json()) as NexarGraphQLResponse<T>;
    if (body.errors && body.errors.length > 0) {
      // GraphQL errors are not a transport failure -- do not retry them.
      throw Errors.serviceUnavailable(`Nexar API returned a GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`);
    }
    if (body.data === undefined) {
      throw Errors.serviceUnavailable("Nexar API returned no data and no error");
    }
    return body.data;
  }

  // Unreachable in practice (every branch above either returns or throws),
  // but keeps the function's return type honest for TypeScript.
  throw lastError instanceof Error ? lastError : Errors.serviceUnavailable("Nexar GraphQL request failed");
}

// Exposed for tests only, to reset the module-level token cache between
// cases without needing vi.resetModules() for every file that imports this.
export function __resetNexarClientStateForTests(): void {
  cachedToken = null;
  tokenRequestInFlight = null;
}
