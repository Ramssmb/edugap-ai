import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { AuthContext, type AuthState, type User } from "./auth-context";

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
    // Initial session check; state is only set in the async callbacks.
    api<{ user: User | null }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    // A 401 from any API call (expired session, deactivated account) signs the user out.
    const onUnauthorized = () => {
      setUser(null);
      qc.clear();
    };
    window.addEventListener("edugap:unauthorized", onUnauthorized);
    return () => window.removeEventListener("edugap:unauthorized", onUnauthorized);
  }, [qc]);

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
