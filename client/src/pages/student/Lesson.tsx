import { useNavigate, useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, Lightbulb, Bot, Sparkles, ListChecks, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Attempt } from "@/lib/types";
import { Card, PageSkeleton, ErrorState, Button, Badge, ButtonLink } from "@/components/ui";
import { Markdown } from "@/lib/markdown";
import { cn, subjectColor, timeAgo } from "@/lib/utils";

type Lesson = { id: number; topicId: number; title: string; summary: string; content: string; keyPoints: string[]; example: string; durationMinutes: number; level: string; topicName: string; subjectName: string; color: string; completedAt: string | null; recommended: boolean };

export default function LessonPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["lesson", id], queryFn: () => api<Lesson>(`/catalog/lessons/${id}`) });
  const complete = useMutation({
    mutationFn: () => api(`/student/lessons/${id}/complete`, { method: "POST", body: {} }),
    onSuccess: () => {
      toast.success("Lesson complete! Now check your understanding with a practice set.");
      void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && ((q.queryKey[0] as string).startsWith("student") || q.queryKey[0] === "lessons" || q.queryKey[0] === "lesson") });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const practice = useMutation({
    mutationFn: () => api<Attempt>("/student/attempts", { body: { mode: "practice", topicId: data!.topicId } }),
    onSuccess: (a) => navigate(`/student/attempt/${a.resultId}`),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const c = subjectColor(data.color);
  const done = Boolean(data.completedAt);
  // Studied before, but the latest results say it is worth another read.
  const restudy = done && data.recommended;

  return (
    <div className="mx-auto max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="h-4 w-4" /> Back</Button>
      <Card className="overflow-hidden">
        <div className={cn("border-b border-slate-100 p-6 sm:p-10", c.soft)}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-lg bg-white px-2 py-1 text-xs font-semibold shadow-sm", c.fg)}>{data.subjectName}</span>
            <Badge>{data.topicName}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-slate-600"><Clock className="h-3.5 w-3.5" /> {data.durationMinutes} min</span>
            {done && <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Completed {timeAgo(data.completedAt)}</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold">{data.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">{data.summary}</p>
        </div>
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_260px]">
          <article>
            <Markdown text={data.content} className="prose-lesson" />
            {data.example && (
              <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/50 p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-brand-800"><Lightbulb className="h-4 w-4" /> Worked example</div>
                <p className="mt-2 leading-relaxed text-slate-700">{data.example}</p>
              </div>
            )}
          </article>
          <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-ink"><ListChecks className="h-4 w-4 text-brand-600" /> Key points</div>
              <ul className="mt-3 space-y-2.5">
                {data.keyPoints.map((k, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{k}</li>
                ))}
              </ul>
            </div>
            <Link to={`/student/tutor?topic=${data.topicId}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-brand-200 hover:bg-brand-50/40">
              <Bot className="h-5 w-5 text-brand-600" />
              <span className="flex-1 text-sm font-medium text-ink">Still confused? Ask the AI tutor</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          </aside>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 p-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p className="text-sm text-slate-600">
            {restudy ? "Your latest results show gaps here, so this lesson is back in your plan. Re-read it, then mark it studied." : done ? "Great — now prove it with 5 targeted questions." : "Finished reading? Mark it complete to update your learning plan."}
          </p>
          <div className="flex gap-2">
            {(!done || restudy) && <Button onClick={() => complete.mutate()} loading={complete.isPending}><CheckCircle2 className="h-4 w-4" /> {restudy ? "Mark as studied again" : "Mark as complete"}</Button>}
            <Button variant={done && !restudy ? "primary" : "outline"} onClick={() => practice.mutate()} loading={practice.isPending}><Sparkles className="h-4 w-4" /> Practise this topic</Button>
          </div>
        </div>
      </Card>
      <div className="mt-4 text-center"><ButtonLink to="/student/recommendations" variant="ghost" size="sm">Back to my learning plan</ButtonLink></div>
    </div>
  );
}
