import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, BookOpen, Target, CheckCircle2, X, ArrowRight, Printer, Star, CalendarDays, Clock, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Attempt, Gap, Recommendation } from "@/lib/types";
import { Card, CardHeader, PageHeader, Skeleton, ErrorState, Button, ButtonLink, Badge, StatusBadge, MasteryBar, SourceBadge, EmptyState, Tabs, Trend } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";

type Report = {
  headline: string;
  summary: string;
  strengths: string[];
  focusAreas: { topic: string; concept: string; whyItMatters: string; action: string }[];
  weeklyPlan: { day: string; task: string }[];
};

function ReportCard() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["student-report"],
    queryFn: () => api<{ report: Report; source: "ai" | "rules"; gaps: Gap[] }>("/student/report"),
    staleTime: 5 * 60_000,
  });
  if (isLoading)
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Sparkles className="h-4 w-4 animate-pulse text-brand-600" /> Analysing your results and writing your report…
        </div>
        <Skeleton className="mt-4 h-6 w-3/4" />
        <Skeleton className="mt-3 h-16" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      </Card>
    );
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const r = data.report;
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-brand-100 uppercase">
            <Sparkles className="h-4 w-4" /> Personal improvement report
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium ring-1 ring-white/25">{data.source === "ai" ? "Written by Claude from your results" : "Built by the rule-based engine from your results"}</span>
        </div>
        <h2 className="mt-3 text-2xl font-extrabold text-white">{r.headline}</h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-brand-50/90">{r.summary}</p>
      </div>
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-500 uppercase"><Target className="h-4 w-4 text-rose-500" /> Focus areas</h3>
          {r.focusAreas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No focus areas — everything assessed is strong.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {r.focusAreas.map((f, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-medium text-slate-500">{f.topic}</div>
                  <div className="mt-0.5 font-semibold text-ink">{f.concept}</div>
                  <p className="mt-2 text-sm text-slate-600">{f.whyItMatters}</p>
                  <p className="mt-2 flex gap-1.5 text-sm font-medium text-brand-700"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />{f.action}</p>
                </div>
              ))}
            </div>
          )}
          {r.strengths.length > 0 && (
            <>
              <h3 className="mt-6 flex items-center gap-2 text-sm font-bold tracking-wide text-slate-500 uppercase"><Star className="h-4 w-4 text-amber-500" /> Strengths</h3>
              <ul className="mt-3 space-y-2">
                {r.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{s}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-500 uppercase"><CalendarDays className="h-4 w-4 text-brand-600" /> This week's plan</h3>
          <ol className="mt-3 space-y-2.5">
            {r.weeklyPlan.map((d, i) => (
              <li key={i} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                <span className="w-12 shrink-0 text-xs font-bold text-brand-700 uppercase">{d.day.slice(0, 3)}</span>
                <span className="text-sm text-slate-700">{d.task}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isFetching}>Refresh</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function GapMap({ gaps }: { gaps: Gap[] }) {
  const subjects = [...new Set(gaps.map((g) => g.subjectName))];
  if (!gaps.length) return null;
  return (
    <Card>
      <CardHeader title="Knowledge gap map" description="Every assessed topic, with the specific concepts you're missing" icon={<Target className="h-5 w-5" />} />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-3">
        {subjects.map((s) => (
          <div key={s}>
            <div className="mb-3 text-sm font-bold text-ink">{s}</div>
            <div className="space-y-3">
              {gaps
                .filter((g) => g.subjectName === s)
                .sort((a, b) => a.mastery - b.mastery)
                .map((g) => (
                  <div key={g.topicId} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{g.topicName}</span>
                      <StatusBadge status={g.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <MasteryBar value={g.mastery} className="h-1.5 flex-1" />
                      <span className="text-xs font-bold text-ink">{Math.round(g.mastery)}%</span>
                      {g.previousMastery !== null && <Trend value={g.mastery - g.previousMastery} suffix="" />}
                    </div>
                    {g.weakConcepts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {g.weakConcepts.map((c) => (
                          <span key={c.concept} className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700" title={`Missed ${c.missed} of ${c.attempted}`}>
                            {c.concept} · {c.missed}/{c.attempted}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function LearningPlan() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const recs = useQuery({ queryKey: ["student-recs"], queryFn: () => api<{ pending: Recommendation[]; completed: Recommendation[] }>("/student/recommendations") });
  const gaps = useQuery({ queryKey: ["student-gaps"], queryFn: () => api<Gap[]>("/student/gaps") });
  const start = useMutation({
    mutationFn: (topicId: number) => api<Attempt>("/student/attempts", { body: { mode: "practice", topicId } }),
    onSuccess: (a) => {
      if (a.source === "ai") toast.success("Claude wrote fresh questions for your weak concepts");
      navigate(`/student/attempt/${a.resultId}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const dismiss = useMutation({
    mutationFn: (id: number) => api(`/student/recommendations/${id}/dismiss`, { method: "POST", body: {} }),
    onSuccess: () => {
      toast("Recommendation dismissed");
      void qc.invalidateQueries({ queryKey: ["student-recs"] });
      void qc.invalidateQueries({ queryKey: ["student-dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const list = tab === "pending" ? recs.data?.pending : recs.data?.completed;

  return (
    <div className="space-y-6">
      <PageHeader title="My learning plan" description="Your personal report, your gap map, and the next steps chosen for you. Everything here is updated each time you complete an assessment." />
      {gaps.data && gaps.data.length === 0 ? (
        <Card>
          <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Your plan starts with one assessment" description="Take a diagnostic in any subject. We'll analyse every answer and build your plan here." action={<ButtonLink to="/student/assessments">Take a diagnostic</ButtonLink>} />
        </Card>
      ) : (
        <>
          <ReportCard />
          <Card>
            <CardHeader
              title="Recommended for you"
              description="Weakest topics first. Lessons explain; practice checks you've got it."
              icon={<Sparkles className="h-5 w-5" />}
              action={<Tabs value={tab} onChange={setTab} tabs={[{ value: "pending", label: "To do", count: recs.data?.pending.length }, { value: "completed", label: "Done", count: recs.data?.completed.length }]} />}
              className="flex-col sm:flex-row"
            />
            <div className="p-5 sm:p-6">
              {recs.isLoading && <Skeleton className="h-40" />}
              {recs.error && <ErrorState error={recs.error} onRetry={recs.refetch} />}
              {list && list.length === 0 && (
                <EmptyState
                  icon={tab === "pending" ? <CheckCircle2 className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
                  title={tab === "pending" ? "All caught up!" : "Nothing completed yet"}
                  description={tab === "pending" ? "No open recommendations. Take another assessment to keep improving." : "Finish a recommended lesson and it will appear here."}
                />
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {list?.map((r) => (
                  <div key={r.id} className={cn("flex flex-col rounded-2xl border p-5 transition", r.status === "pending" ? "border-slate-200 hover:border-brand-200 hover:shadow-sm" : "border-slate-100 bg-slate-50/60")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={r.type === "lesson" ? "brand" : "violet"}>{r.type === "lesson" ? <><BookOpen className="h-3 w-3" /> Lesson</> : <><Sparkles className="h-3 w-3" /> Practice</>}</Badge>
                        <Badge>{r.subjectName}</Badge>
                        {r.priority < 1000 && r.status === "pending" && <Badge tone="red">High priority</Badge>}
                      </div>
                      {r.status === "pending" && (
                        <button type="button" onClick={() => dismiss.mutate(r.id)} className="rounded-lg p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500" aria-label={`Dismiss ${r.title}`} title="Dismiss">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <h3 className="mt-3 font-semibold text-ink">{r.title}</h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{r.reason}</p>
                    {r.concepts.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {r.concepts.map((c) => (
                          <span key={c} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{c}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      {r.status === "pending" ? (
                        r.type === "lesson" && r.lessonId ? (
                          <ButtonLink to={`/student/lessons/${r.lessonId}`} size="sm">Start lesson <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>
                        ) : (
                          <Button size="sm" onClick={() => start.mutate(r.topicId)} loading={start.isPending && start.variables === r.topicId} disabled={start.isPending}>
                            Start practice <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Completed {timeAgo(r.completedAt)}</span>
                      )}
                      {r.type === "lesson" && r.lessonMinutes && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" /> {r.lessonMinutes} min</span>}
                    </div>
                  </div>
                ))}
              </div>
              {tab === "pending" && recs.data?.pending.some((r) => r.type === "practice") && (
                <p className="mt-4 text-xs text-slate-500">
                  <SourceBadge source="ai" /> appears on practice sets when Claude writes new questions for your weak concepts; otherwise questions come from the curated bank.
                </p>
              )}
            </div>
          </Card>
          {gaps.data && <GapMap gaps={gaps.data} />}
        </>
      )}
    </div>
  );
}
