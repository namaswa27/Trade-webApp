// src/auth/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch, setAccessToken } from "./api";

export type User = {
  id: number;
  name: string;
  phone: string;
  role: "admin" | "customer";
};

type AuthContextValue = {
  user: User | null;
  isAuthed: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  signUp: (p: { name: string; phone: string; password: string }) => Promise<User>;
  login: (p: { phone: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMe = async () => {
    try {
      const d: any = await apiFetch("/api/auth/me");
      setUser(d.user as User);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await refreshMe();
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (p: { name: string; phone: string; password: string }) => {
    const d: any = await apiFetch("/api/auth/signup", { method: "POST", body: p, retry: false });
    setAccessToken(d.accessToken);
    setUser(d.user as User);
    return d.user as User;
  };

  const login = async (p: { phone: string; password: string }) => {
    const d: any = await apiFetch("/api/auth/login", { method: "POST", body: p, retry: false });
    setAccessToken(d.accessToken);
    setUser(d.user as User);
    return d.user as User;
  };

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", retry: false });
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        isAuthed: !!user,
        isAdmin: user?.role === "admin",
        isLoading,
        signUp,
        login,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
