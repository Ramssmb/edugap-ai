import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, GraduationCap, School, ShieldCheck, ArrowRight, Target, Sparkles, LineChart } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/AppShell";
import { Button, Field, Input, Select } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth, homeFor } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" className="self-start">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.45),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(79,70,229,0.5),transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-center px-14 text-brand-100">
          <h2 className="max-w-md text-4xl leading-tight font-extrabold text-white">Learning that knows exactly where you are.</h2>
          <div className="mt-10 space-y-6">
            {[
              { icon: <Target />, t: "Pinpoint gaps", d: "Every answer is analysed at the concept level." },
              { icon: <Sparkles />, t: "Personal plan", d: "Lessons and practice chosen for you, updated after every quiz." },
              { icon: <LineChart />, t: "Visible progress", d: "See your mastery grow topic by topic." },
            ].map((x) => (
              <div key={x.t} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 [&_svg]:h-5 [&_svg]:w-5">{x.icon}</div>
                <div>
                  <div className="font-semibold text-white">{x.t}</div>
                  <div className="text-sm text-brand-200/80">{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, invalid, autoComplete }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} invalid={invalid} autoComplete={autoComplete} className="pr-11" required />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// The demo password is documented in the README; it is only shown in development builds.
const DEMO_PASSWORD = import.meta.env.DEV ? "EduGap@2026" : "";
const DEMO = [
  { role: "Student", email: "aarav@edugap.demo", icon: <GraduationCap className="h-4 w-4" />, note: "Gaps in fractions & percentages" },
  { role: "Teacher", email: "anita.sharma@edugap.demo", icon: <School className="h-4 w-4" />, note: "Grade 8-A" },
  { role: "Admin", email: "admin@edugap.demo", icon: <ShieldCheck className="h-4 w-4" />, note: "Platform management" },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent, override?: { email: string; password: string }) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const u = await login(override?.email ?? email, override?.password ?? password);
      toast.success(`Welcome back, ${u.name.split(" ")[0]}!`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith(homeFor(u.role)) ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle={<>New to EduGap? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</div>}
        <Field label="Email" htmlFor="email" error={fields.email}>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" invalid={!!fields.email} required placeholder="you@school.edu" />
        </Field>
        <Field label="Password" htmlFor="password" error={fields.password}>
          <PasswordInput id="password" value={password} onChange={setPassword} invalid={!!fields.password} autoComplete="current-password" />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-8 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4">
        <div className="text-sm font-semibold text-ink">Demo accounts</div>
        <p className="mt-0.5 text-xs text-slate-500">
          {DEMO_PASSWORD ? "One click to sign in as each role." : "Use the demo password from the README."} All demo accounts end in <code>@edugap.demo</code>.
        </p>
        <div className="mt-3 grid gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              disabled={loading}
              onClick={(e) => {
                setEmail(d.email);
                if (DEMO_PASSWORD) {
                  setPassword(DEMO_PASSWORD);
                  void submit(e as unknown as FormEvent, { email: d.email, password: DEMO_PASSWORD });
                }
              }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:shadow-sm disabled:opacity-60"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{d.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{d.role}</span>
                <span className="block truncate text-xs text-slate-500">{d.email} · {d.note}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [form, setForm] = useState({ name: "", email: "", password: "", grade: "8", classId: "", department: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const { data: classes } = useQuery({ queryKey: ["public-classes"], queryFn: () => api<{ id: number; name: string; grade: number }[]>("/auth/classes") });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pwChecks = [
    { ok: form.password.length >= 8, label: "8+ characters" },
    { ok: /[A-Za-z]/.test(form.password), label: "A letter" },
    { ok: /[0-9]/.test(form.password), label: "A number" },
  ];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const body =
        role === "student"
          ? { role, name: form.name, email: form.email, password: form.password, grade: Number(form.grade), classId: form.classId ? Number(form.classId) : null }
          : { role, name: form.name, email: form.email, password: form.password, department: form.department };
      const u = await register(body);
      if (!u) {
        setPending(true);
        return;
      }
      toast.success("Account created — welcome to EduGap AI!");
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiError) setFields(err.fields);
    } finally {
      setLoading(false);
    }
  }

  if (pending)
    return (
      <AuthLayout title="Request received" subtitle="Thanks for signing up as a teacher.">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">Your account is waiting for approval.</p>
          <p className="mt-1">Teacher accounts can see student results, so an administrator verifies each one. You'll be able to sign in once they activate it and assign your classes.</p>
        </div>
        <Link to="/login" className="mt-6 inline-flex font-semibold text-brand-600 hover:underline">Back to sign in</Link>
      </AuthLayout>
    );

  return (
    <AuthLayout title="Create your account" subtitle={<>Already have one? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link></>}>
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Account type">
        {(["student", "teacher"] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={cn("flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition", role === r ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink")}
          >
            {r === "student" ? <GraduationCap className="h-4 w-4" /> : <School className="h-4 w-4" />}
            I'm a {r}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</div>}
        <Field label="Full name" htmlFor="name" error={fields.name}>
          <Input id="name" value={form.name} onChange={set("name")} autoComplete="name" invalid={!!fields.name} required />
        </Field>
        <Field label="Email" htmlFor="reg-email" error={fields.email}>
          <Input id="reg-email" type="email" value={form.email} onChange={set("email")} autoComplete="email" invalid={!!fields.email} required />
        </Field>
        <Field label="Password" htmlFor="reg-password" error={fields.password}>
          <PasswordInput id="reg-password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} invalid={!!fields.password} autoComplete="new-password" />
          <div className="mt-2 flex flex-wrap gap-3">
            {pwChecks.map((c) => (
              <span key={c.label} className={cn("text-xs font-medium", c.ok ? "text-emerald-600" : "text-slate-400")}>
                {c.ok ? "✓" : "○"} {c.label}
              </span>
            ))}
          </div>
        </Field>
        {role === "student" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Grade" htmlFor="grade" error={fields.grade}>
              <Select id="grade" value={form.grade} onChange={set("grade")}>
                {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </Select>
            </Field>
            <Field label="Class (optional)" htmlFor="class" error={fields.classId} hint="Lets your teacher see your progress">
              <Select id="class" value={form.classId} onChange={set("classId")}>
                <option value="">No class yet</option>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <Field label="Department" htmlFor="dept" error={fields.department} hint="An administrator approves teacher accounts and assigns classes.">
            <Input id="dept" value={form.department} onChange={set("department")} placeholder="e.g. Mathematics" invalid={!!fields.department} />
          </Field>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-xs text-slate-500">Your data is only visible to you, your teacher and your school's administrators.</p>
      </form>
    </AuthLayout>
  );
}
