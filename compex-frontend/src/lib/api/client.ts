const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init?.headers ?? {}),
  };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

  return parseJson<T>(res);
}
