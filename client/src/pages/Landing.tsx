import { Link } from "react-router-dom";
import {
  ArrowRight,
  Brain,
  Target,
  Route as RouteIcon,
  Bot,
  LineChart,
  Users,
  ShieldCheck,
  Languages,
  ClipboardCheck,
  Sparkles,
  CheckCircle2,
  XCircle,
  GraduationCap,
  School,
  Search,
  BookOpen,
} from "lucide-react";
import { Logo } from "@/components/layout/AppShell";
import { buttonClass } from "@/components/ui";
import { useAuth, homeFor } from "@/lib/auth";

function Nav() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="EduGap AI home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex" aria-label="Sections">
          <a href="#problem" className="hover:text-ink">Problem</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#impact" className="hover:text-ink">Impact</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to={homeFor(user.role)} className={buttonClass("primary", "md")}>
              Open dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link to="/login" className={buttonClass("ghost", "md", "hidden sm:inline-flex")}>Sign in</Link>
              <Link to="/register" className={buttonClass("primary", "md")}>Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Illustrative product preview built from real UI pieces (sample data). */
function HeroPreview() {
  const topics = [
    { name: "Linear Equations", v: 86, c: "bg-emerald-500" },
    { name: "Geometry", v: 71, c: "bg-amber-500" },
    { name: "Percentages", v: 48, c: "bg-rose-500" },
    { name: "Fractions", v: 34, c: "bg-rose-500" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-brand-500/20 via-violet-400/20 to-cyan-300/20 blur-2xl" />
      <div className="card overflow-hidden p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold tracking-wider text-brand-600 uppercase">Gap report · Mathematics</div>
            <div className="mt-1 font-display text-lg font-bold text-ink">What Aarav doesn't understand yet</div>
          </div>
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200">Sample</span>
        </div>
        <div className="mt-5 space-y-3.5">
          {topics.map((t) => (
            <div key={t.name}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-slate-700">{t.name}</span>
                <span className="font-semibold text-ink">{t.v}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${t.c}`} style={{ width: `${t.v}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/60 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
            <Target className="h-4 w-4" /> Exact gap detected
          </div>
          <p className="mt-1 text-sm text-rose-900/80">
            Missed <b>"Adding unlike denominators"</b> 3 of 3 times — adds denominators instead of finding a common one.
          </p>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-ink">Next: 12-min lesson + 5 targeted questions</div>
            <div className="text-slate-500">Personalised to this exact concept</div>
          </div>
          <ArrowRight className="h-4 w-4 text-brand-600" />
        </div>
      </div>
      <div className="card absolute -bottom-6 -left-4 hidden items-center gap-3 px-4 py-3 sm:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <LineChart className="h-5 w-5" />
        </div>
        <div className="text-sm">
          <div className="font-semibold text-ink">Fractions 34% → 78%</div>
          <div className="text-xs text-slate-500">after one study cycle</div>
        </div>
      </div>
    </div>
  );
}

const steps = [
  { icon: <ClipboardCheck />, title: "Assess", text: "Students take short adaptive quizzes. Every question is tagged with the precise concept it tests." },
  { icon: <Search />, title: "Detect", text: "The gap engine scores mastery per topic and pinpoints the exact concepts behind wrong answers." },
  { icon: <RouteIcon />, title: "Personalise", text: "Each student gets a learning plan: the right lesson, targeted practice, and an AI tutor that knows their gaps." },
  { icon: <LineChart />, title: "Improve", text: "Retakes update mastery instantly. Students see progress; teachers see who still needs help." },
];

const features = [
  { icon: <Target />, title: "Concept-level gap detection", text: "Not just 'weak at maths' — 'struggles with dividing fractions'. Strong, needs improvement, or weak, from real answers." },
  { icon: <Brain />, title: "Adaptive assessments", text: "Questions adapt to each student's level and focus on their weak concepts, with fresh questions on every retry." },
  { icon: <Sparkles />, title: "Personalised learning plans", text: "Recommendations that update after every attempt and explain exactly why each step was chosen." },
  { icon: <Bot />, title: "AI tutor in 4 languages", text: "Step-by-step explanations in English, Hindi, Punjabi and Telugu, pitched at the student's grade level." },
  { icon: <Users />, title: "Teacher insight", text: "Class heatmaps, common misconceptions, students who need attention, and one-click performance reports." },
  { icon: <ShieldCheck />, title: "Private and secure", text: "Role-based access, server-side grading, and API keys that never touch the browser." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pt-24 lg:pb-28">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5" /> AI-powered personalised learning
            </div>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold sm:text-5xl lg:text-6xl">
              Find exactly what each student{" "}
              <span className="bg-gradient-to-r from-brand-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">doesn't understand yet.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              EduGap AI analyses every answer, pinpoints the precise concepts a student is missing, and builds a personal path to fix them — while giving teachers a clear view of their whole class.
            </p>
            <p className="mt-4 font-display text-sm font-bold tracking-wide text-brand-700">Identify Learning Gaps. Personalize Learning. Improve Futures.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className={buttonClass("primary", "lg")}>
                Start learning free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" className={buttonClass("outline", "lg")}>Try the demo accounts</Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Grades 6–12</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Maths, Science, English</span>
              <span className="inline-flex items-center gap-1.5"><Languages className="h-4 w-4 text-emerald-500" /> 4 languages</span>
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="border-y border-slate-100 bg-surface py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-sm font-semibold tracking-wider text-brand-600 uppercase">The problem</div>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">One score hides a dozen different gaps</h2>
            <p className="mt-4 text-lg text-slate-600">
              Two students can both score 60% for completely different reasons. Traditional tests report the number, not the reason — so students re-study what they already know and the real gap keeps growing.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { t: "Gaps compound", d: "A student who never understood fractions struggles with percentages, then ratios, then algebra. Small gaps become big ones." },
              { t: "Teachers lack time", d: "With 40 students, no teacher can analyse every wrong answer to find out what each child is actually missing." },
              { t: "One pace for all", d: "The class moves on together. Students who need more time fall behind; students who are ready get bored." },
            ].map((p) => (
              <div key={p.t} className="card p-6">
                <XCircle className="h-6 w-6 text-rose-500" />
                <h3 className="mt-4 text-lg font-bold">{p.t}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-sm font-semibold tracking-wider text-brand-600 uppercase">The solution</div>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">A closed learning loop for every student</h2>
          </div>
          <div className="relative mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="relative">
                <div className="card h-full p-6 transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white [&_svg]:h-5 [&_svg]:w-5">{s.icon}</div>
                    <span className="font-display text-4xl font-extrabold text-slate-100">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-brand-950 py-20 text-brand-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold tracking-wider text-brand-300 uppercase">Key features</div>
            <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">AI that does real teaching work — not just a chatbot</h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="bg-brand-950 p-7 transition hover:bg-[#25216b]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-brand-200 [&_svg]:h-5 [&_svg]:w-5">{f.icon}</div>
                <h3 className="mt-5 text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-200/80">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            { icon: <GraduationCap />, role: "Students", points: ["See strengths and weak concepts", "Follow a plan built for you", "Ask the tutor in your language", "Watch your mastery grow"] },
            { icon: <School />, role: "Teachers", points: ["Classroom heatmap by topic", "Students needing attention", "Create & assign assessments", "AI performance reports"] },
            { icon: <ShieldCheck />, role: "Administrators", points: ["Manage users and roles", "Manage subjects & lessons", "Platform-wide statistics", "Live activity monitoring"] },
          ].map((r) => (
            <div key={r.role} className="card p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:h-5 [&_svg]:w-5">{r.icon}</div>
              <h3 className="mt-5 text-xl font-bold">For {r.role}</h3>
              <ul className="mt-4 space-y-2.5">
                {r.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Impact */}
      <section id="impact" className="border-t border-slate-100 bg-surface py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="text-sm font-semibold tracking-wider text-brand-600 uppercase">Impact</div>
              <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Every study minute aimed at the right target</h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                When students know exactly what to fix, practice becomes efficient and confidence grows. When teachers know exactly who is stuck on what, a five-minute intervention replaces a week of re-teaching.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className={buttonClass("primary", "lg")}>Create a free account</Link>
                <Link to="/login" className={buttonClass("outline", "lg")}><BookOpen className="h-4 w-4" /> Explore the demo</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "Concept-level", v: "Diagnosis of every wrong answer" },
                { k: "Adaptive", v: "Questions matched to each learner" },
                { k: "Instant", v: "Mastery updates after each attempt" },
                { k: "Inclusive", v: "Tutoring in 4 Indian languages" },
              ].map((s) => (
                <div key={s.k} className="card p-6">
                  <div className="font-display text-xl font-extrabold text-brand-700">{s.k}</div>
                  <div className="mt-1 text-sm text-slate-600">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <p>Identify Learning Gaps. Personalize Learning. Improve Futures.</p>
          <p>© {new Date().getFullYear()} EduGap AI</p>
        </div>
      </footer>
    </div>
  );
}
