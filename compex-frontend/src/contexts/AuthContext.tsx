"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, logout as apiLogout, type AuthUser } from "@/lib/api/auth";
import { getMyCompany } from "@/lib/api/customers";

type AuthContextValue = {
  user: AuthUser | null;
  companyName: string | null;
  isLoading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  companyName: null,
  isLoading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const me = await getMe();
        setUser(me);
        if (me.companyId) {
          const company = await getMyCompany();
          setCompanyName(company.name);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    void init();
  }, []);

  async function logout() {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      setCompanyName(null);
      window.location.href = "/login";
    }
  }

  return (
    <AuthContext.Provider value={{ user, companyName, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
