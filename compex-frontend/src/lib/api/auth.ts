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

export function login(email: string, password: string) {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
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

export function logout() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
}

export function getMe() {
  return apiFetch<AuthUser>("/auth/me");
}
