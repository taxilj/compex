import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { nexarGraphQL, __resetNexarClientStateForTests } from "../../src/modules/catalog-import/fetchers/nexar-client.js";

const TOKEN_URL = "https://identity.nexar.com/connect/token";
const GRAPHQL_URL = "https://api.nexar.com/graphql";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function tokenOk(expiresIn = 3600) {
  return jsonResponse(200, { access_token: "fake-token", token_type: "Bearer", expires_in: expiresIn });
}

// env is a plain parsed object (see src/config/env.ts), not readonly at
// runtime, so tests can safely stub credentials in and restore them after --
// this repo's real test environment (.env) intentionally has no Nexar
// credentials configured, which the first describe block below exercises.
const originalClientId = env.NEXAR_CLIENT_ID;
const originalClientSecret = env.NEXAR_CLIENT_SECRET;

function setFakeCredentials() {
  env.NEXAR_CLIENT_ID = "test-client-id";
  env.NEXAR_CLIENT_SECRET = "test-client-secret";
}

function restoreCredentials() {
  env.NEXAR_CLIENT_ID = originalClientId;
  env.NEXAR_CLIENT_SECRET = originalClientSecret;
}

beforeEach(() => {
  __resetNexarClientStateForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  restoreCredentials();
});

describe("nexarGraphQL - missing credentials", () => {
  it("throws a clear SERVICE_UNAVAILABLE error naming the missing env vars, without calling fetch, when NEXAR_CLIENT_ID/SECRET are unset", async () => {
    restoreCredentials(); // this repo's test .env has none configured, but be explicit
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(nexarGraphQL("query { __typename }", {})).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: expect.stringMatching(/NEXAR_CLIENT_ID.*NEXAR_CLIENT_SECRET/),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("nexarGraphQL - OAuth token handling", () => {
  beforeEach(setFakeCredentials);

  it("fetches a token via client-credentials grant, then reuses the cached token on a second call", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === TOKEN_URL) return tokenOk();
      if (url === GRAPHQL_URL) return jsonResponse(200, { data: { ok: true } });
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await nexarGraphQL("query A", {});
    await nexarGraphQL("query B", {});

    const tokenCalls = fetchMock.mock.calls.filter(([url]) => url === TOKEN_URL);
    const graphqlCalls = fetchMock.mock.calls.filter(([url]) => url === GRAPHQL_URL);
    expect(tokenCalls).toHaveLength(1); // token cached across both nexarGraphQL calls
    expect(graphqlCalls).toHaveLength(2);
  });

  it("sends grant_type=client_credentials and the configured scope to the token endpoint", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === TOKEN_URL) {
        const params = new URLSearchParams(init!.body as string);
        expect(params.get("grant_type")).toBe("client_credentials");
        expect(params.get("client_id")).toBe("test-client-id");
        expect(params.get("client_secret")).toBe("test-client-secret");
        expect(params.get("scope")).toBe(env.NEXAR_SCOPE);
        return tokenOk();
      }
      return jsonResponse(200, { data: {} });
    });
    vi.stubGlobal("fetch", fetchMock);
    await nexarGraphQL("query A", {});
  });

  it("never logs the client secret", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => tokenOk());
    vi.stubGlobal("fetch", fetchMock);
    await nexarGraphQL("query A", {}).catch(() => {});
    for (const call of errorSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("test-client-secret");
    }
    errorSpy.mockRestore();
  });
});

describe("nexarGraphQL - authentication failure (no retry)", () => {
  beforeEach(setFakeCredentials);

  it("does not retry a 401 from the GraphQL endpoint and surfaces a clear error", async () => {
    let graphqlAttempts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === TOKEN_URL) return tokenOk();
      graphqlAttempts++;
      return jsonResponse(401, { error: "invalid_token" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(nexarGraphQL("query A", {})).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(graphqlAttempts).toBe(1);
  });

  it("does not retry a 403 from the token endpoint (bad credentials) and never fakes success", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === TOKEN_URL) return jsonResponse(403, { error: "access_denied" });
      throw new Error("should never reach the GraphQL endpoint without a token");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(nexarGraphQL("query A", {})).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});

describe("nexarGraphQL - transient failure retry/backoff", () => {
  beforeEach(setFakeCredentials);

  it("retries a 429 with backoff up to the retry budget, then throws RATE_LIMITED", async () => {
    let graphqlAttempts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === TOKEN_URL) return tokenOk();
      graphqlAttempts++;
      return jsonResponse(429, {}, { "retry-after": "0" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(nexarGraphQL("query A", {})).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(graphqlAttempts).toBeGreaterThan(1); // proves it actually retried, not just failed once
  });

  it("retries a 5xx upstream outage and succeeds once the upstream recovers", async () => {
    let graphqlAttempts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === TOKEN_URL) return tokenOk();
      graphqlAttempts++;
      if (graphqlAttempts === 1) return jsonResponse(503, { error: "upstream outage" });
      return jsonResponse(200, { data: { ok: true } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await nexarGraphQL<{ ok: boolean }>("query A", {});
    expect(result).toEqual({ ok: true });
    expect(graphqlAttempts).toBe(2);
  });

  it("does not retry a GraphQL-level error (query executed, Nexar returned errors[])", async () => {
    let graphqlAttempts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === TOKEN_URL) return tokenOk();
      graphqlAttempts++;
      return jsonResponse(200, { errors: [{ message: "part limit exceeded for this organisation" }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(nexarGraphQL("query A", {})).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: expect.stringContaining("part limit exceeded"),
    });
    expect(graphqlAttempts).toBe(1);
  });
});

describe("nexarGraphQL - timeout handling", () => {
  beforeEach(setFakeCredentials);

  it("times out the token request instead of hanging forever", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => new Promise<Response>(() => {})); // never resolves
    vi.stubGlobal("fetch", fetchMock);

    const pending = nexarGraphQL("query A", {}).catch((err) => err);
    await vi.advanceTimersByTimeAsync(10_001);
    const err = await pending;
    expect(err).toMatchObject({ code: "SERVICE_UNAVAILABLE", message: expect.stringMatching(/timed out/i) });
  });
});
