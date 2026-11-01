import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Sparkles, AlertTriangle, CheckCircle2, ClipboardCheck, BookOpen, Flame, LineChart as LineIcon, Target, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { Gap, StudentDashboard, StudentProgress } from "@/lib/types";
import { Card, CardHeader, PageSkeleton, ErrorState, Avatar, MasteryRing, StatCard, StatusBadge, MasteryBar, Trend, Badge, Button, Skeleton, SourceBadge } from "@/components/ui";
import { MasteryTimeline } from "@/components/charts";
import { pct, formatDate, cn } from "@/lib/utils";

type Detail = { dashboard: StudentDashboard; progress: StudentProgress; gaps: Gap[] };
type Summary = { summary: { overview: string; concerns: string[]; progress: string; suggestedActions: string[] }; source: "ai" | "rules"; generatedAt: string };

function SummaryCard({ id }: { id: string }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ["teacher-summary", id], queryFn: () => api<Summary>(`/teacher/students/${id}/summary`), staleTime: 5 * 60_000 });
  return (
    <Card className="border-brand-200">
      <CardHeader
        title="Performance summary"
        description="Written from this student's real results"
        icon={<Sparkles className="h-5 w-5" />}
        action={data && <div className="flex items-center gap-2"><SourceBadge source={data.source} /><Button size="icon" variant="ghost" onClick={() => refetch()} aria-label="Regenerate summary" className="no-print"><RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /></Button></div>}
      />
      <div className="p-5 sm:p-6">
        {isLoading && (<><Skeleton className="h-5 w-3/4" /><Skeleton className="mt-3 h-16" /></>)}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {data && (
          <div className="space-y-5">
            <p className="leading-relaxed text-slate-700">{data.summary.overview}</p>
            <p className="text-sm font-medium text-brand-700">{data.summary.progress}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-slate-500 uppercase"><AlertTriangle className="h-4 w-4 text-rose-500" /> Concerns</div>
                <ul className="space-y-1.5">
                  {data.summary.concerns.length === 0 && <li className="text-sm text-slate-500">None.</li>}
                  {data.summary.concerns.map((c, i) => <li key={i} className="text-sm text-slate-700">• {c}</li>)}
                </ul>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-slate-500 uppercase"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Suggested actions</div>
                <ul className="space-y-1.5">
                  {data.summary.suggestedActions.map((c, i) => <li key={i} className="text-sm text-slate-700">• {c}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function TeacherStudentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["teacher-student", id], queryFn: () => api<Detail>(`/teacher/students/${id}`) });
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const { dashboard: d, progress: p, gaps } = data;
  const subjects = [...new Set(gaps.map((g) => g.subjectName))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print report</Button>
      </div>

      <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <Avatar name={d.profile?.name ?? "?"} color={d.profile?.avatarColor} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{d.profile?.name}</h1>
          <p className="text-sm text-slate-500">{d.profile?.email} · {d.profile?.className ?? "No class"} · Grade {d.profile?.grade}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="red">{d.topics.weak.length} weak</Badge>
            <Badge tone="amber">{d.topics.needsImprovement.length} need improvement</Badge>
            <Badge tone="green">{d.topics.strong.length} strong</Badge>
          </div>
        </div>
        <MasteryRing value={d.stats.overallMastery} size={110} stroke={9} label="overall" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assessments" value={d.stats.assessmentsCompleted} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label="Lessons completed" value={d.stats.lessonsCompleted} icon={<BookOpen className="h-5 w-5" />} accent="green" />
        <StatCard label="Current streak" value={`${d.stats.streak} days`} icon={<Flame className="h-5 w-5" />} accent="amber" />
      </div>

      <SummaryCard id={id} />

      <Card>
        <CardHeader title="Topic-wise gaps" description="Mastery per topic with the specific concepts this student is missing" icon={<Target className="h-5 w-5" />} />
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-3">
          {subjects.length === 0 && <p className="text-sm text-slate-500">No assessments yet.</p>}
          {subjects.map((s) => (
            <div key={s}>
              <div className="mb-3 text-sm font-bold text-ink">{s}</div>
              <div className="space-y-3">
                {gaps.filter((g) => g.subjectName === s).map((g) => (
                  <div key={g.topicId}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-ink">{g.topicName}</span>
                      <StatusBadge status={g.status} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <MasteryBar value={g.mastery} className="h-1.5 flex-1" />
                      <span className="w-10 text-right text-xs font-bold text-ink">{Math.round(g.mastery)}%</span>
                      {g.previousMastery !== null && <Trend value={g.mastery - g.previousMastery} suffix="" />}
                    </div>
                    {g.weakConcepts.length > 0 && <div className="mt-1 text-xs text-rose-700">{g.weakConcepts.map((c) => `${c.concept} (${c.missed}/${c.attempted})`).join(", ")}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Improvement over time" icon={<LineIcon className="h-5 w-5" />} />
          <div className="p-3 sm:p-5">
            {p.timeline.length ? <MasteryTimeline data={p.timeline} subjects={p.subjects} height={260} /> : <p className="p-4 text-sm text-slate-500">No data yet.</p>}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent assessments" icon={<ClipboardCheck className="h-5 w-5" />} />
          <ul className="divide-y divide-slate-100 p-2 sm:p-3">
            {p.history.length === 0 && <li className="p-3 text-sm text-slate-500">None yet.</li>}
            {p.history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <Link to={`/teacher/results/${h.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                  <span className={cn("w-12 text-sm font-bold", (h.percent ?? 0) >= 75 ? "text-emerald-700" : (h.percent ?? 0) >= 50 ? "text-amber-700" : "text-rose-700")}>{pct(h.percent)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{h.title}</div>
                    <div className="text-xs text-slate-500">{formatDate(h.completedAt, { day: "numeric", month: "short" })} · {h.kind}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
