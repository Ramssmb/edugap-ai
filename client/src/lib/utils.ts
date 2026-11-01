import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type GapStatus = "strong" | "needs_improvement" | "weak";

export const STATUS_META: Record<GapStatus, { label: string; text: string; bg: string; ring: string; bar: string; dot: string }> = {
  strong: { label: "Strong", text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  needs_improvement: { label: "Needs improvement", text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", bar: "bg-amber-500", dot: "bg-amber-500" },
  weak: { label: "Weak", text: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", bar: "bg-rose-500", dot: "bg-rose-500" },
};

export function statusFor(mastery: number | null): GapStatus | null {
  if (mastery === null) return null;
  return mastery >= 75 ? "strong" : mastery >= 50 ? "needs_improvement" : "weak";
}

export const masteryColor = (m: number | null) => {
  const s = statusFor(m);
  return s === "strong" ? "#10b981" : s === "needs_improvement" ? "#f59e0b" : s === "weak" ? "#f43f5e" : "#cbd5e1";
};

/** Subject accent colours — explicit class names so Tailwind keeps them. */
export const SUBJECT_COLORS: Record<string, { fg: string; bg: string; soft: string; hex: string }> = {
  indigo: { fg: "text-indigo-600", bg: "bg-indigo-600", soft: "bg-indigo-50", hex: "#4f46e5" },
  emerald: { fg: "text-emerald-600", bg: "bg-emerald-600", soft: "bg-emerald-50", hex: "#059669" },
  violet: { fg: "text-violet-600", bg: "bg-violet-600", soft: "bg-violet-50", hex: "#7c3aed" },
  sky: { fg: "text-sky-600", bg: "bg-sky-600", soft: "bg-sky-50", hex: "#0284c7" },
  amber: { fg: "text-amber-600", bg: "bg-amber-500", soft: "bg-amber-50", hex: "#d97706" },
  rose: { fg: "text-rose-600", bg: "bg-rose-600", soft: "bg-rose-50", hex: "#e11d48" },
  teal: { fg: "text-teal-600", bg: "bg-teal-600", soft: "bg-teal-50", hex: "#0d9488" },
};
export const subjectColor = (c?: string | null) => SUBJECT_COLORS[c ?? "indigo"] ?? SUBJECT_COLORS.indigo;

export const AVATAR_COLORS: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-700",
  violet: "bg-violet-100 text-violet-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-700",
  teal: "bg-teal-100 text-teal-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const pct = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : `${n.toFixed(digits)}%`);

export function formatDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", opts);
}

export function timeAgo(d: string | Date | null | undefined) {
  if (!d) return "never";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  return formatDate(d);
}

export function dueLabel(d: string | null) {
  if (!d) return { text: "No due date", tone: "text-slate-500" };
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);
  if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, tone: "text-rose-600" };
  if (days === 0) return { text: "Due today", tone: "text-amber-600" };
  if (days === 1) return { text: "Due tomorrow", tone: "text-amber-600" };
  return { text: `Due in ${days} days`, tone: "text-slate-500" };
}

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
] as const;

export function average(nums: number[]): number | null {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
}
