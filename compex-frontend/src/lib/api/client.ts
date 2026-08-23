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
  const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
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
    fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers: buildHeaders(init) });

  let res = await makeReq();

  if (res.status === 401) {
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
