import { apiFetch } from "./client";

export interface AuthUser {
  id: string;
  role: string;
  customerId?: string;
  companyId?: string;
}

export interface LoginResult {
  accessToken: string;
  user: { id: string; email: string; role: string; firstName: string; lastName: string };
}

const SESSION_MARKER = "cx_session";

export async function login(email: string, password: string) {
  const result = await apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // First-party marker for middleware route gating — the real access/refresh
  // tokens live as httpOnly cookies on the API's own (cross-site) domain and
  // are never visible to the frontend's Next.js middleware.
  document.cookie = `${SESSION_MARKER}=1; path=/; max-age=${30 * 24 * 60 * 60}`;
  return result;
}

export function register(data: {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gstin?: string;
  city?: string;
  password: string;
}) {
  return apiFetch<{ message: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logout() {
  try {
    return await apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
  } finally {
    document.cookie = `${SESSION_MARKER}=; path=/; max-age=0`;
  }
}

export function getMe() {
  return apiFetch<AuthUser>("/auth/me");
}
