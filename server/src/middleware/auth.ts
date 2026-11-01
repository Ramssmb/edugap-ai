import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import { HttpError } from "./errors.js";

export type Role = "student" | "teacher" | "admin";
export type AuthUser = { id: number; role: Role; name: string; email: string };

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export const COOKIE = "edugap_session";

export function issueSession(res: Response, userId: number, sessionVersion: number) {
  const token = jwt.sign({ sub: String(userId), v: sessionVersion }, config.jwtSecret, {
    expiresIn: `${config.sessionHours}h`,
    algorithm: "HS256",
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.isProd,
    maxAge: config.sessionHours * 3600 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/", httpOnly: true, sameSite: "strict", secure: config.isProd });
}

/**
 * Loads the user on every request instead of trusting role claims in the token,
 * so a role change or deactivation by an admin takes effect immediately.
 */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }) as { sub: string; v?: number };
    const id = Number(payload.sub);
    const [u] = await db()
      .select({ id: schema.users.id, role: schema.users.role, name: schema.users.name, email: schema.users.email, isActive: schema.users.isActive, sessionVersion: schema.users.sessionVersion })
      .from(schema.users)
      .where(eq(schema.users.id, id));
    if (u && u.isActive && (payload.v ?? 0) === u.sessionVersion) req.user = { id: u.id, role: u.role, name: u.name, email: u.email };
  } catch {
    // invalid/expired token: treat as anonymous
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Please sign in to continue"));
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Please sign in to continue"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "You do not have access to this area"));
    next();
  };

/**
 * CSRF defence in depth (cookies are already SameSite=Strict): state-changing
 * requests must carry a custom header, which browsers will not send cross-site
 * without a CORS preflight that this server never approves.
 */
export function requireCsrfHeader(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.get("x-requested-with") !== "edugap") return next(new HttpError(403, "Missing request header"));
  next();
}
