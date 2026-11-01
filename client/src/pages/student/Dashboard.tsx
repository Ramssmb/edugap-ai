import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Flame, ClipboardCheck, BookOpen, Target, ArrowRight, CheckCircle2, Circle, Sparkles, CalendarClock, Trophy, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Attempt, Gap, StudentDashboard } from "@/lib/types";
import { Card, CardHeader, PageHeader, StatCard, MasteryRing, MasteryBar, Trend, PageSkeleton, ErrorState, EmptyState, Badge, ButtonLink, Button, Progress } from "@/components/ui";
import { subjectIcon } from "@/components/subject-icon";
import { cn, subjectColor, pct, formatDate, dueLabel, STATUS_META } from "@/lib/utils";


function TopicColumn({ title, items, status, icon }: { title: string; items: Gap[]; status: Gap["status"]; icon: React.ReactNode }) {
  const m = STATUS_META[status];
  return (
    <div className="flex min-w-0 flex-col">
      <div className={cn("mb-3 flex items-center gap-2 text-sm font-semibold", m.text)}>
        {icon} {title}
        <span className={cn("ml-auto rounded-full px-2 text-xs ring-1 ring-inset", m.bg, m.ring)}>{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">None yet</p>}
        {items.slice(0, 5).map((g) => (
          <div key={g.topicId} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-ink">{g.topicName}</span>
              <span className="text-sm font-bold text-ink">{Math.round(g.mastery)}%</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="truncate">{g.subjectName}</span>
              {g.previousMastery !== null && <Trend value={g.mastery - g.previousMastery} suffix="" />}
            </div>
            {g.weakConcepts[0] && status !== "strong" && <div className="mt-1.5 truncate text-xs text-slate-600">Gap: <span className="font-medium">{g.weakConcepts[0].concept}</span></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["student-dashboard"], queryFn: () => api<StudentDashboard>("/student/dashboard") });
  const start = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Attempt>("/student/attempts", { body }),
    onSuccess: (a) => navigate(`/student/attempt/${a.resultId}`),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const first = data.profile?.name.split(" ")[0] ?? "there";
  const hasData = data.stats.topicsAssessed > 0;
  const goalsDone = data.dailyGoals.filter((g) => g.current >= g.target).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const pendingAssigned = data.assigned.filter((a) => !a.completed);

  return (
    <div>
      <PageHeader
        eyebrow={data.profile?.className ?? `Grade ${data.profile?.grade}`}
        title={`${greeting}, ${first}`}
        description={hasData ? "Here's where your learning stands today, and what to do next." : "Let's find out what you already know. Take your first diagnostic to unlock your learning plan."}
        actions={
          <>
            <ButtonLink to="/student/tutor" variant="outline"><Sparkles className="h-4 w-4" /> Ask the tutor</ButtonLink>
            <ButtonLink to="/student/assessments"><ClipboardCheck className="h-4 w-4" /> Take an assessment</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex items-center gap-5 p-5 sm:col-span-2 xl:col-span-1">
          <MasteryRing value={data.stats.overallMastery} size={104} stroke={9} label="overall" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-500">Overall mastery</div>
            <div className="mt-1 text-sm text-slate-600">
              {data.stats.topicsAssessed} of {data.stats.totalTopics} topics assessed
            </div>
            <Progress value={(data.stats.topicsAssessed / Math.max(1, data.stats.totalTopics)) * 100} className="mt-2 h-1.5" />
          </div>
        </Card>
        <StatCard label="Day streak" value={<span className="inline-flex items-center gap-2">{data.stats.streak}<Flame className={cn("h-6 w-6", data.stats.streak ? "text-orange-500" : "text-slate-300")} /></span>} icon={<Flame className="h-5 w-5" />} accent="amber" hint={data.stats.streak ? "Keep it going — learn something today." : "Complete a lesson or quiz to start a streak."} />
        <StatCard label="Assessments completed" value={data.stats.assessmentsCompleted} icon={<ClipboardCheck className="h-5 w-5" />} accent="brand" hint={data.recentResults[0] ? `Last: ${pct(data.recentResults[0].percent)} on ${formatDate(data.recentResults[0].completedAt, { day: "numeric", month: "short" })}` : "None yet"} />
        <StatCard label="Lessons completed" value={data.stats.lessonsCompleted} icon={<BookOpen className="h-5 w-5" />} accent="green" hint={<Link to="/student/lessons" className="font-medium text-brand-600 hover:underline">Browse lessons →</Link>} />
      </div>

      {pendingAssigned.length > 0 && (
        <Card className="mt-6 flex flex-col gap-4 border-brand-200 bg-gradient-to-r from-brand-50 to-white p-5 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink">Your teacher assigned {pendingAssigned.length === 1 ? `"${pendingAssigned[0].title}"` : `${pendingAssigned.length} assessments`}</div>
            <div className={cn("text-sm", dueLabel(pendingAssigned[0].dueAt).tone)}>
              {pendingAssigned[0].subjectName} · {pendingAssigned[0].questionCount} questions · {dueLabel(pendingAssigned[0].dueAt).text}
            </div>
          </div>
          <Button onClick={() => start.mutate({ mode: "assigned", assessmentId: pendingAssigned[0].id })} loading={start.isPending && start.variables?.mode === "assigned"}>
            Start now <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Subject performance" description="Average mastery across the topics you've been assessed on" icon={<TrendingUp className="h-5 w-5" />} />
          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
            {data.subjects.map((s) => {
              const c = subjectColor(s.color);
              return (
                <div key={s.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", c.soft, c.fg)}>{subjectIcon(s.icon)}</div>
                    <Trend value={s.change} suffix=" this wk" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-slate-500">{s.name}</div>
                  <div className="font-display text-2xl font-extrabold text-ink">{pct(s.mastery)}</div>
                  <MasteryBar value={s.mastery} className="mt-2" />
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{s.topicsAssessed}/{s.totalTopics} topics</span>
                    <button type="button" className="font-semibold text-brand-600 hover:underline disabled:opacity-50" disabled={start.isPending} onClick={() => start.mutate({ mode: "diagnostic", subjectId: s.id })}>
                      {s.topicsAssessed ? "Retake" : "Start"} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Today's goals" description={`${goalsDone} of ${data.dailyGoals.length} complete`} icon={<Trophy className="h-5 w-5" />} action={<Link to="/settings" className="text-xs font-medium text-brand-600 hover:underline">Edit</Link>} />
          <div className="space-y-4 p-5 sm:p-6">
            {data.dailyGoals.map((g) => {
              const done = g.current >= g.target;
              return (
                <div key={g.key}>
                  <div className="flex items-center gap-2.5 text-sm">
                    {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-slate-300" />}
                    <span className={cn("flex-1 font-medium", done ? "text-slate-400 line-through" : "text-ink")}>{g.label}</span>
                    <span className="text-xs font-semibold text-slate-500">{g.current}/{g.target}</span>
                  </div>
                  {g.target > 1 && <Progress value={(g.current / g.target) * 100} className="mt-2 ml-7 h-1.5 w-[calc(100%-1.75rem)]" barClassName={done ? "bg-emerald-500" : undefined} />}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Your topics"
            description="Classified from your actual answers: 75%+ strong, 50–74% needs improvement, below 50% weak"
            icon={<Target className="h-5 w-5" />}
            action={<ButtonLink to="/student/recommendations" variant="ghost" size="sm">Full report <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>}
          />
          {hasData ? (
            <div className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
              <TopicColumn title="Weak" items={data.topics.weak} status="weak" icon={<AlertTriangle className="h-4 w-4" />} />
              <TopicColumn title="Needs work" items={data.topics.needsImprovement} status="needs_improvement" icon={<Target className="h-4 w-4" />} />
              <TopicColumn title="Strong" items={data.topics.strong} status="strong" icon={<CheckCircle2 className="h-4 w-4" />} />
            </div>
          ) : (
            <EmptyState icon={<Target className="h-6 w-6" />} title="No topics assessed yet" description="Take a diagnostic in any subject and we'll show your strengths and gaps here." action={<ButtonLink to="/student/assessments">Choose a subject</ButtonLink>} />
          )}
        </Card>

        <Card>
          <CardHeader title="Do this next" description="From your personalised plan" icon={<Sparkles className="h-5 w-5" />} />
          <div className="space-y-3 p-5 sm:p-6">
            {data.recommendations.length === 0 && (
              <p className="text-sm text-slate-500">{hasData ? "You're on top of everything. Try a harder assessment!" : "Your plan appears after your first assessment."}</p>
            )}
            {data.recommendations.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 p-3.5">
                <div className="flex items-center gap-2">
                  <Badge tone={r.type === "lesson" ? "brand" : "violet"}>{r.type === "lesson" ? "Lesson" : "Practice"}</Badge>
                </div>
                <div className="mt-2 text-sm font-semibold text-ink">{r.title}</div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.reason}</p>
                {r.type === "lesson" && r.lessonId ? (
                  <ButtonLink to={`/student/lessons/${r.lessonId}`} size="sm" variant="soft" className="mt-3">Open lesson</ButtonLink>
                ) : (
                  <Button size="sm" variant="soft" className="mt-3" loading={start.isPending && start.variables?.topicId === r.topicId} disabled={start.isPending} onClick={() => start.mutate({ mode: "practice", topicId: r.topicId })}>
                    Start practice
                  </Button>
                )}
              </div>
            ))}
            {data.recommendations.length > 0 && (
              <Link to="/student/recommendations" className="block pt-1 text-center text-sm font-semibold text-brand-600 hover:underline">See full learning plan</Link>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent assessments" icon={<ClipboardCheck className="h-5 w-5" />} action={<ButtonLink to="/student/progress" variant="ghost" size="sm">All history <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>} />
        <div className="p-2 sm:p-3">
          {data.recentResults.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No assessments yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentResults.map((r) => (
                <li key={r.id}>
                  <Link to={`/student/results/${r.id}`} className="flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-slate-50">
                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold", (r.percent ?? 0) >= 75 ? "bg-emerald-50 text-emerald-700" : (r.percent ?? 0) >= 50 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>
                      {Math.round(r.percent ?? 0)}%
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{r.title}</div>
                      <div className="text-xs text-slate-500">{r.subjectName} · {r.score}/{r.total} correct · {formatDate(r.completedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
                    </div>
                    <Badge tone={r.kind === "practice" ? "violet" : r.kind === "assigned" ? "sky" : "brand"} className="hidden sm:inline-flex">{r.kind}</Badge>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
