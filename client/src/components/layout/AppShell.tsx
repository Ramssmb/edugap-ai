import { useEffect, useId, useState, type ReactNode } from "react";
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ClipboardCheck,
  Sparkles,
  Bot,
  LineChart,
  BookOpen,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Activity,
  Library,
  School,
} from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  // Unique per instance: a duplicate gradient id inside a hidden copy breaks the visible one.
  const gid = `logo${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
        <path d="M9 21.5 14 11l3.5 7 2-3.5L23 21.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="19.5" cy="14.5" r="1.8" fill="#a5f3fc" />
      </svg>
      <span className={cn("font-display text-lg font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>
        EduGap<span className={light ? "text-brand-300" : "text-brand-600"}> AI</span>
      </span>
    </span>
  );
}

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };

const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: "/student", label: "Dashboard", icon: <LayoutDashboard />, end: true },
    { to: "/student/assessments", label: "Assessments", icon: <ClipboardCheck /> },
    { to: "/student/recommendations", label: "My Learning Plan", icon: <Sparkles /> },
    { to: "/student/lessons", label: "Lessons", icon: <BookOpen /> },
    { to: "/student/tutor", label: "AI Tutor", icon: <Bot /> },
    { to: "/student/progress", label: "Progress", icon: <LineChart /> },
  ],
  teacher: [
    { to: "/teacher", label: "Classroom", icon: <LayoutDashboard />, end: true },
    { to: "/teacher/students", label: "Students", icon: <Users /> },
    { to: "/teacher/assessments", label: "Assessments", icon: <FileText /> },
  ],
  admin: [
    { to: "/admin", label: "Overview", icon: <LayoutDashboard />, end: true },
    { to: "/admin/users", label: "Users & Roles", icon: <Users /> },
    { to: "/admin/classes", label: "Classes", icon: <School /> },
    { to: "/admin/content", label: "Subjects & Content", icon: <Library /> },
    { to: "/admin/activity", label: "Activity", icon: <Activity /> },
    { to: "/teacher", label: "Classroom view", icon: <ShieldCheck /> },
  ],
};

const ROLE_LABEL: Record<Role, string> = { student: "Student", teacher: "Teacher", admin: "Administrator" };

function AiStatus() {
  const { data } = useQuery({ queryKey: ["health"], queryFn: () => api<{ ai: "enabled" | "offline" }>("/health"), staleTime: 5 * 60_000 });
  if (!data) return null;
  const on = data.ai === "enabled";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
      <div className="flex items-center gap-2 font-semibold text-white">
        <span className={cn("h-2 w-2 rounded-full", on ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" : "bg-amber-400")} />
        {on ? "AI engine: Claude" : "AI engine: offline mode"}
      </div>
      <p className="mt-1 leading-relaxed text-brand-200/80">{on ? "Reports, tutoring and practice are generated live." : "Using the rule-based engine and lesson library. Add an API key to enable Claude."}</p>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-brand-950 via-brand-950 to-[#1a1744] px-4 py-5 text-brand-100">
      <Link to="/" className="mb-7 px-2" onClick={onNavigate}>
        <Logo light />
      </Link>
      <div className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-brand-300/70 uppercase">{ROLE_LABEL[user.role]}</div>
      <nav className="flex flex-col gap-1" aria-label="Main">
        {NAV[user.role].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition [&_svg]:h-[18px] [&_svg]:w-[18px]",
                isActive ? "bg-white/12 text-white shadow-inner shadow-white/5" : "text-brand-200/80 hover:bg-white/6 hover:text-white",
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        <AiStatus />
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition [&_svg]:h-[18px] [&_svg]:w-[18px]", isActive ? "bg-white/12 text-white" : "text-brand-200/80 hover:bg-white/6 hover:text-white")}
        >
          <Settings /> Profile & settings
        </NavLink>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
          <Avatar name={user.name} size="sm" color="violet" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="truncate text-xs text-brand-300/80">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className="rounded-lg p-2 text-brand-200 transition hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-72">
      <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block no-print">
        <Sidebar />
      </aside>
      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden no-print">
        <Link to="/">
          <Logo />
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-xs animate-slide-up shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-3 z-10 rounded-lg p-2 text-brand-200 hover:bg-white/10" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div key={location.pathname} className="animate-slide-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
