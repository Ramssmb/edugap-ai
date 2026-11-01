import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, "..");

const env = process.env;
const isProd = env.NODE_ENV === "production";
const isTest = env.NODE_ENV === "test" || env.VITEST === "true";

function jwtSecret(): string {
  const s = env.JWT_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd) throw new Error("JWT_SECRET must be set (at least 32 characters) in production.");
  const random = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (isTest) return random();
  // Development only: generate a secret once and keep it in the git-ignored data
  // dir, so sessions survive the dev server's hot restarts.
  const file = path.join(SERVER_ROOT, ".data", "dev-jwt-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const s = random();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}

export const config = {
  isProd,
  isTest,
  // In development the client dev server owns PORT-style env vars, so the API uses
  // API_PORT; in production the single server honours the platform's PORT.
  port: Number(env.API_PORT ?? (isProd ? env.PORT : undefined) ?? 4000),
  databaseUrl: env.DATABASE_URL || "",
  // Embedded Postgres (PGlite) data dir, used when DATABASE_URL is empty. "memory" = in-memory.
  pgliteDir: isTest ? "memory" : env.PGLITE_DIR || path.join(SERVER_ROOT, ".data", "pglite"),
  jwtSecret: jwtSecret(),
  sessionHours: 12,
  anthropicApiKey: isTest ? "" : env.ANTHROPIC_API_KEY || "",
  aiModel: env.AI_MODEL || "claude-opus-5-5",
  // Only trust X-Forwarded-For when actually behind a proxy (e.g. TRUST_PROXY=1);
  // otherwise clients could spoof their IP to dodge rate limits.
  // Public address of the site, used in robots.txt/sitemap.xml. Optional: defaults to the request's host.
  publicUrl: env.PUBLIC_URL || "",
  // Google Search Console "HTML tag" verification token (the content="..." value only).
  googleSiteVerification: (env.GOOGLE_SITE_VERIFICATION || "").trim(),
  trustProxy: env.TRUST_PROXY ? (Number.isFinite(Number(env.TRUST_PROXY)) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY) : false,
};

export const aiEnabled = () => Boolean(config.anthropicApiKey);
