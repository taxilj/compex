// Always same-origin: the browser only ever talks to this app's own domain,
// which proxies to the real API via next.config.ts rewrites. That keeps the
// API's auth cookies first-party instead of cross-site.
const API_URL = "/api/v1";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// No request may hang forever (e.g. Render free-tier cold start or a stalled
// upstream): every call is bounded and surfaces a real TIMEOUT error the UI
// can render with a Retry. Uploads get a longer budget.
export const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

// fetch() with a timeout that also honours a caller-supplied AbortSignal
// (stale-request cancellation). A caller abort rethrows as-is (AbortError);
// only our own timeout becomes ApiError(TIMEOUT).
async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const timeoutMs = init.body instanceof FormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", onCallerAbort, { once: true });
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    // Headers can arrive and the body still stall: read it while the timer runs.
    if (!res.body || res.status === 204 || res.status === 205 || res.status === 304) return res;
    return new Response(await res.arrayBuffer(), { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch (err) {
    if (timedOut) throw new ApiError(0, "TIMEOUT", "The server took too long to respond");
    throw err;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onCallerAbort);
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return {} as T;
  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, "PARSE_ERROR", "Invalid server response");
  }
  if (json.success === false) {
    const err = json.error as { code?: string; message?: string; details?: unknown[] } | undefined;
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? "Request failed", err?.details);
  }
  return json.data as T;
}

let pendingRefresh: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const res = await fetchWithTimeout(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
  if (!res.ok) throw new ApiError(401, "UNAUTHORIZED", "Session expired");
}

function buildHeaders(init?: RequestInit): HeadersInit {
  const isFormData = init?.body instanceof FormData;
  const hasJsonBody = !isFormData && !!init?.body;
  return {
    ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers ?? {}),
  };
}

async function fetchWithRefresh(path: string, init?: RequestInit): Promise<Response> {
  const makeReq = () =>
    fetchWithTimeout(`${API_URL}${path}`, { ...init, credentials: "include", headers: buildHeaders(init) });

  let res = await makeReq();

  const isPublicAuthRequest = path === "/auth/login" || path === "/auth/register" || path === "/auth/verify-email" || path === "/auth/complete-account-setup";

  if (res.status === 401 && !isPublicAuthRequest) {
    try {
      if (!pendingRefresh) pendingRefresh = doRefresh().finally(() => { pendingRefresh = null; });
      await pendingRefresh;
      res = await makeReq();
    } catch {
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new ApiError(401, "UNAUTHORIZED", "Session expired");
    }
  }

  return res;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parseJson<T>(await fetchWithRefresh(path, init));
}

// Public endpoints deliberately use a separate same-origin namespace. This
// prevents product lookup from inheriting authenticated refresh/redirect
// behaviour and keeps its browser URL at /api/products/lookup.
export async function apiFetchPublic<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(path, { ...init, credentials: "same-origin", headers: buildHeaders(init) });
  return parseJson<T>(res);
}

export async function apiFetchPaginated<T>(path: string, init?: RequestInit): Promise<{ data: T[]; total: number; page: number; limit: number }> {
  const res = await fetchWithRefresh(path, init);
  if (res.status === 204) return { data: [], total: 0, page: 1, limit: 20 };
  let json: { success: boolean; data: T[]; meta?: { total: number; page: number; limit: number }; error?: { code?: string; message?: string; details?: unknown[] } };
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, "PARSE_ERROR", "Invalid server response");
  }
  if (json.success === false) {
    const err = json.error;
    throw new ApiError(res.status, err?.code ?? "ERROR", err?.message ?? "Request failed", err?.details);
  }
  return { data: json.data ?? [], total: json.meta?.total ?? json.data?.length ?? 0, page: json.meta?.page ?? 1, limit: json.meta?.limit ?? 20 };
}
