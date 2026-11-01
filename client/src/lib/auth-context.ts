import { createContext, useContext } from "react";

export type Role = "student" | "teacher" | "admin";
export type User = { id: number; name: string; email: string; role: Role };

export type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  /** Returns the signed-in user, or null when the account needs administrator approval. */
  register: (body: Record<string, unknown>) => Promise<User | null>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export const homeFor = (role: Role) => (role === "student" ? "/student" : role === "teacher" ? "/teacher" : "/admin");

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
