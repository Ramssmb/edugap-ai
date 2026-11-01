import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ArrowRight, CalendarClock, CheckCircle2, Zap, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Attempt, Subject, Topic } from "@/lib/types";
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Badge, StatusBadge, MasteryBar, EmptyState } from "@/components/ui";
import { cn, subjectColor, dueLabel, pct, formatDate, type GapStatus } from "@/lib/utils";
import { subjectIcon } from "@/components/subject-icon";

type Data = {
  subjects: (Omit<Subject, "topics"> & { topics: (Topic & { mastery: number | null; status: GapStatus | null })[] })[];
  assigned: { id: number; title: string; dueAt: string | null; questionCount: number; subjectName: string; latest: { id: number; percent: number | null; completedAt: string } | null }[];
};

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["student-assessments"], queryFn: () => api<Data>("/student/assessments") });
  const start = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Attempt>("/student/attempts", { body }),
    onSuccess: (a) => navigate(`/student/attempt/${a.resultId}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const busy = (k: string, v: number) => start.isPending && (start.variables as Record<string, unknown>)?.[k] === v;

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Diagnostics cover a whole subject and adapt to your level. Practice sets target one topic and focus on the concepts you've been missing."
      />

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <CalendarClock className="h-5 w-5 text-brand-600" /> Assigned by your teacher
        </h2>
        {data.assigned.length === 0 ? (
          <Card>
            <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nothing assigned right now" description="When your teacher assigns an assessment it will appear here." />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.assigned.map((a) => {
              const due = dueLabel(a.dueAt);
              return (
                <Card key={a.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-ink">{a.title}</div>
                      <div className="mt-0.5 text-sm text-slate-500">{a.subjectName} · {a.questionCount} questions</div>
                    </div>
                    {a.latest ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Done · {pct(a.latest.percent)}</Badge> : <span className={cn("text-xs font-semibold", due.tone)}>{due.text}</span>}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" variant={a.latest ? "outline" : "primary"} loading={busy("assessmentId", a.id)} disabled={start.isPending} onClick={() => start.mutate({ mode: "assigned", assessmentId: a.id })}>
                      {a.latest ? "Retake" : "Start"} <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                    {a.latest && (
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/student/results/${a.latest!.id}`)}>
                        View result · {formatDate(a.latest.completedAt, { day: "numeric", month: "short" })}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <ClipboardCheck className="h-5 w-5 text-brand-600" /> Subjects
        </h2>
        <div className="grid gap-5 lg:grid-cols-3">
          {data.subjects.map((s) => {
            const c = subjectColor(s.color);
            const assessed = s.topics.filter((t) => t.mastery !== null);
            return (
              <Card key={s.id} className="flex flex-col overflow-hidden">
                <div className={cn("p-5", c.soft)}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm", c.fg)}>{subjectIcon(s.icon)}</div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold">{s.name}</h3>
                      <p className="truncate text-xs text-slate-600">{s.description}</p>
                    </div>
                  </div>
                  <Button className="mt-4 w-full" loading={busy("subjectId", s.id)} disabled={start.isPending || s.topics.length === 0} onClick={() => start.mutate({ mode: "diagnostic", subjectId: s.id })}>
                    <Zap className="h-4 w-4" /> {assessed.length ? "Retake diagnostic" : "Start diagnostic"} · 10 questions
                  </Button>
                </div>
                <div className="flex-1 divide-y divide-slate-100 px-5">
                  {s.topics.length === 0 && <p className="py-4 text-sm text-slate-500">No topics yet.</p>}
                  {s.topics.map((t) => (
                    <div key={t.id} className="py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">{t.name}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <MasteryBar value={t.mastery} className="h-1.5 flex-1" />
                        <span className="w-10 text-right text-xs font-semibold text-slate-600">{pct(t.mastery)}</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-brand-600" loading={busy("topicId", t.id)} disabled={start.isPending} onClick={() => start.mutate({ mode: "practice", topicId: t.id })} aria-label={`Practise ${t.name}`}>
                          <Sparkles className="h-3.5 w-3.5" /> Practise
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
