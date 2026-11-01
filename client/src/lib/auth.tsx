import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export type Role = "student" | "teacher" | "admin";
export type User = { id: number; name: string; email: string; role: Role };

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  /** Returns the signed-in user, or null when the account needs administrator approval. */
  register: (body: Record<string, unknown>) => Promise<User | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const homeFor = (role: Role) => (role === "student" ? "/student" : role === "teacher" ? "/teacher" : "/admin");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User | null }>("/auth/me");
      setUser(r.user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUser(null);
      else throw e;
    }
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // A 401 from any API call (expired session, deactivated account) signs the user out.
    const onUnauthorized = () => {
      setUser(null);
      qc.clear();
    };
    window.addEventListener("edugap:unauthorized", onUnauthorized);
    return () => window.removeEventListener("edugap:unauthorized", onUnauthorized);
  }, [refresh, qc]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refresh,
      async login(email, password) {
        const r = await api<{ user: User }>("/auth/login", { body: { email, password } });
        qc.clear();
        setUser(r.user);
        return r.user;
      },
      async register(body) {
        const r = await api<{ user?: User; pending?: boolean }>("/auth/register", { body });
        if (!r.user) return null;
        qc.clear();
        setUser(r.user);
        return r.user;
      },
      async logout() {
        await api("/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
        qc.clear();
        setUser(null);
      },
    }),
    [user, loading, refresh, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
