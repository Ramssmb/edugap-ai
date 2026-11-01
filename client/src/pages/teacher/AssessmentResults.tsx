import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader, PageHeader, PageSkeleton, ErrorState, Avatar, Badge, MasteryBar, Button, StatCard } from "@/components/ui";
import { pct, formatDate, dueLabel, masteryColor, average } from "@/lib/utils";

type Data = {
  assessment: { id: number; title: string; dueAt: string | null; questionCount: number };
  students: { id: number; name: string; avatarColor: string; attempts: number; best: number | null; latest: { resultId: number; percent: number; score: number; total: number; completedAt: string } | null }[];
  items: { id: number; prompt: string; concept: string; difficulty: string; topicName: string; position: number; answered: number; percentCorrect: number | null }[];
};

export default function AssessmentResults() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["teacher-assessment", id], queryFn: () => api<Data>(`/teacher/assessments/${id}/results`) });
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const done = data.students.filter((s) => s.latest);
  const avg = average(done.map((s) => s.latest!.percent));
  const hardest = [...data.items].filter((i) => i.percentCorrect !== null).sort((a, b) => a.percentCorrect! - b.percentCorrect!)[0];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/assessments")}><ArrowLeft className="h-4 w-4" /> All assessments</Button>
      <PageHeader title={data.assessment.title} description={`${data.assessment.questionCount} questions · ${dueLabel(data.assessment.dueAt).text}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Completed" value={`${done.length} / ${data.students.length}`} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Average score" value={pct(avg)} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <StatCard label="Hardest question" value={hardest ? `Q${hardest.position + 1} · ${hardest.percentCorrect}%` : "—"} icon={<BarChart3 className="h-5 w-5" />} accent="rose" hint={hardest?.concept} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Students" description="Latest attempt per student" icon={<Users className="h-5 w-5" />} />
          <ul className="divide-y divide-slate-100 p-2 sm:p-3">
            {data.students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={s.name} color={s.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link to={`/teacher/students/${s.id}`} className="truncate text-sm font-semibold text-ink hover:text-brand-700">{s.name}</Link>
                  <div className="text-xs text-slate-500">{s.latest ? `${s.latest.score}/${s.latest.total} · ${formatDate(s.latest.completedAt, { day: "numeric", month: "short" })}${s.attempts > 1 ? ` · ${s.attempts} attempts, best ${pct(s.best)}` : ""}` : "Not started"}</div>
                </div>
                {s.latest ? (
                  <Link to={`/teacher/results/${s.latest.resultId}`} className="text-sm font-bold hover:underline" style={{ color: masteryColor(s.latest.percent) }}>{pct(s.latest.percent)}</Link>
                ) : (
                  <Badge><Clock className="h-3 w-3" /> Pending</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Question analysis" description="Share of students who answered each question correctly" icon={<BarChart3 className="h-5 w-5" />} />
          <ul className="space-y-4 p-5 sm:p-6">
            {data.items.map((q) => (
              <li key={q.id}>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-ink"><b className="text-slate-400">Q{q.position + 1}.</b> {q.prompt}</span>
                  <span className="shrink-0 font-bold text-ink">{q.percentCorrect === null ? "—" : `${q.percentCorrect}%`}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <MasteryBar value={q.percentCorrect} className="h-1.5 flex-1" />
                  <span className="text-[11px] text-slate-500">{q.answered} answered</span>
                </div>
                <div className="mt-1 flex gap-1"><Badge>{q.topicName}</Badge><Badge tone="brand">{q.concept}</Badge></div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
