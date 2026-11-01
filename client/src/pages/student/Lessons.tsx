import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, CheckCircle2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Card, PageHeader, PageSkeleton, ErrorState, Input, Tabs, EmptyState, Badge } from "@/components/ui";
import { cn, subjectColor } from "@/lib/utils";

type LessonRow = { id: number; title: string; summary: string; durationMinutes: number; level: string; topicName: string; subjectName: string; subjectSlug: string; color: string; completed: boolean };

export default function Lessons() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["lessons"], queryFn: () => api<LessonRow[]>("/catalog/lessons") });
  const [subject, setSubject] = useState("all");
  const [q, setQ] = useState("");
  const subjects = useMemo(() => [...new Map((data ?? []).map((l) => [l.subjectSlug, l.subjectName])).entries()], [data]);
  const filtered = (data ?? []).filter(
    (l) => (subject === "all" || l.subjectSlug === subject) && (!q.trim() || `${l.title} ${l.topicName} ${l.summary}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const done = data.filter((l) => l.completed).length;

  return (
    <div>
      <PageHeader title="Lesson library" description={`Beginner-friendly lessons for every topic. You've completed ${done} of ${data.length}.`} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={subject} onChange={setSubject} tabs={[{ value: "all", label: "All" }, ...subjects.map(([slug, name]) => ({ value: slug, label: name }))]} />
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons" className="pl-9" aria-label="Search lessons" />
        </div>
      </div>
      {filtered.length === 0 ? (
        <Card><EmptyState icon={<BookOpen className="h-6 w-6" />} title="No lessons match" description="Try a different search or subject." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => {
            const c = subjectColor(l.color);
            return (
              <Link key={l.id} to={`/student/lessons/${l.id}`} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-lg px-2 py-1 text-xs font-semibold", c.soft, c.fg)}>{l.subjectName}</span>
                  {l.completed && <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Done</Badge>}
                </div>
                <div className="mt-4 text-xs font-medium text-slate-500">{l.topicName}</div>
                <h3 className="mt-1 font-bold text-ink group-hover:text-brand-700">{l.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-600">{l.summary}</p>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" /> {l.durationMinutes} min read</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
