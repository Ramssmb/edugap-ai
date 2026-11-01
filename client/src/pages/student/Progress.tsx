import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LineChart as LineIcon, Flame, History, BookOpen, ArrowUpRight, Table2, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import type { StudentProgress } from "@/lib/types";
import { Card, CardHeader, PageHeader, PageSkeleton, ErrorState, Badge, Tabs, EmptyState, StatusBadge, Trend, StatCard } from "@/components/ui";
import { MasteryTimeline, ThenNowBars } from "@/components/charts";
import { cn, formatDate, pct, average } from "@/lib/utils";

export default function ProgressPage() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["student-progress"], queryFn: () => api<StudentProgress>("/student/progress") });
  const [subject, setSubject] = useState("all");
  const [view, setView] = useState<"chart" | "table">("chart");

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  if (!data.history.length)
    return (
      <div>
        <PageHeader title="Progress" />
        <Card><EmptyState icon={<LineIcon className="h-6 w-6" />} title="No progress yet" description="Complete an assessment and your progress charts will appear here." /></Card>
      </div>
    );

  const history = data.history.filter((h) => subject === "all" || String(h.subjectId) === subject);
  // Practice sets deliberately target weak concepts, so they'd drag this average down; compare
  // diagnostics and teacher assessments only.
  const chronological = [...data.history].reverse().filter((h) => h.kind !== "practice");
  const half = Math.max(1, Math.floor(chronological.length / 2));
  const earlyAvg = average(chronological.slice(0, half).map((h) => h.percent ?? 0));
  const recentAvg = average(chronological.slice(half).map((h) => h.percent ?? 0));
  const improved = data.comparison.filter((c) => c.then !== null && c.now - c.then >= 5);
  const maxCount = Math.max(1, ...data.calendar.map((c) => c.count));

  return (
    <div className="space-y-6">
      <PageHeader title="Progress analytics" description="How your mastery has changed over time, topic by topic." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current streak" value={`${data.streak} day${data.streak === 1 ? "" : "s"}`} icon={<Flame className="h-5 w-5" />} accent="amber" />
        <StatCard label="Assessments taken" value={data.history.length} icon={<History className="h-5 w-5" />} />
        <StatCard label="Assessment average: earlier → recent" value={<span className="flex items-baseline gap-2">{pct(earlyAvg)} <span className="text-slate-300">→</span> {pct(recentAvg)}</span>} icon={<ArrowUpRight className="h-5 w-5" />} accent="green" hint={earlyAvg !== null && recentAvg !== null && chronological.length >= 2 ? <span className="flex items-center gap-2"><Trend value={recentAvg - earlyAvg} /> diagnostics &amp; assigned, excluding practice</span> : "Needs two diagnostics or assigned assessments"} />
        <StatCard label="Topics improved" value={improved.length} icon={<BarChart3 className="h-5 w-5" />} accent="violet" hint={improved.slice(0, 2).map((c) => c.topicName).join(", ") || "Keep practising"} />
      </div>

      <Card>
        <CardHeader
          title="Mastery over time"
          description="Average subject mastery after each assessment. Dashed lines mark the 50% and 75% thresholds."
          icon={<LineIcon className="h-5 w-5" />}
          action={<Tabs value={view} onChange={setView} tabs={[{ value: "chart", label: <><LineIcon className="h-3.5 w-3.5" /> Chart</> }, { value: "table", label: <><Table2 className="h-3.5 w-3.5" /> Table</> }]} />}
          className="flex-col sm:flex-row"
        />
        <div className="p-3 sm:p-5">
          {view === "chart" ? (
            <MasteryTimeline data={data.timeline} subjects={data.subjects} />
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    {data.subjects.map((s) => <th key={s.slug} className="px-3 py-2 font-semibold">{s.name}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...data.timeline].reverse().map((row) => (
                    <tr key={String(row.date)}>
                      <td className="px-3 py-2 text-slate-600">{formatDate(String(row.date))}</td>
                      {data.subjects.map((s) => <td key={s.slug} className="px-3 py-2 font-medium text-ink">{row[s.slug] !== undefined ? `${Math.round(Number(row[s.slug]))}%` : "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Then vs now" description="Your mastery after your first assessment on each topic, compared with your mastery today" icon={<BarChart3 className="h-5 w-5" />} />
          <div className="p-3 sm:p-5">
            <ThenNowBars data={data.comparison.slice(0, 8).map((c) => ({ name: c.topicName, then: c.then, now: c.now }))} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Learning activity" description="Last 5 weeks — darker means more lessons and assessments" icon={<Flame className="h-5 w-5" />} />
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`Activity on ${data.calendar.filter((c) => c.count).length} of the last 35 days`}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-slate-400">{d}</div>
              ))}
              {Array.from({ length: (new Date(data.calendar[0].date + "T00:00:00Z").getUTCDay() + 6) % 7 }).map((_, i) => <div key={`pad${i}`} />)}
              {data.calendar.map((c) => (
                <div
                  key={c.date}
                  title={`${formatDate(c.date)}: ${c.count} activit${c.count === 1 ? "y" : "ies"}`}
                  className={cn("aspect-square rounded-md", c.count === 0 && "bg-slate-100")}
                  style={c.count ? { backgroundColor: `rgba(79,70,229,${0.25 + (0.75 * c.count) / maxCount})` } : undefined}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-end gap-1.5 text-[11px] text-slate-500">
              Less
              {[0, 0.35, 0.6, 1].map((o) => <span key={o} className="h-3 w-3 rounded" style={{ backgroundColor: o ? `rgba(79,70,229,${o})` : "#f1f5f9" }} />)}
              More
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><BookOpen className="h-4 w-4 text-brand-600" /> Lessons completed ({data.lessonsCompleted.length})</div>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                {data.lessonsCompleted.length === 0 && <li className="text-sm text-slate-500">None yet.</li>}
                {data.lessonsCompleted.map((l) => (
                  <li key={l.id}>
                    <Link to={`/student/lessons/${l.id}`} className="flex justify-between gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                      <span className="truncate text-slate-700">{l.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">{formatDate(l.completedAt, { day: "numeric", month: "short" })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Topic comparison" description="Where you started and where you are now" />
        <div className="overflow-x-auto p-2 sm:p-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Topic</th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">After first attempt</th>
                <th className="px-3 py-2 font-semibold">Now</th>
                <th className="px-3 py-2 font-semibold">Change</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.comparison.map((c) => (
                <tr key={c.topicId}>
                  <td className="px-3 py-2.5 font-medium text-ink">{c.topicName}</td>
                  <td className="px-3 py-2.5 text-slate-600">{c.subjectName}</td>
                  <td className="px-3 py-2.5 text-slate-600">{pct(c.then)}</td>
                  <td className="px-3 py-2.5 font-semibold text-ink">{pct(c.now)}</td>
                  <td className="px-3 py-2.5">{c.then !== null ? <Trend value={c.now - c.then} /> : "—"}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Assessment history"
          icon={<History className="h-5 w-5" />}
          action={<Tabs value={subject} onChange={setSubject} tabs={[{ value: "all", label: "All" }, ...data.subjects.map((s) => ({ value: String(s.id), label: s.name }))]} />}
          className="flex-col sm:flex-row"
        />
        <div className="overflow-x-auto p-2 sm:p-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">Assessment</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5"><div className="font-medium text-ink">{h.title}</div><div className="text-xs text-slate-500">{h.subjectName}</div></td>
                  <td className="px-3 py-2.5"><Badge tone={h.kind === "practice" ? "violet" : h.kind === "assigned" ? "sky" : "brand"}>{h.kind}</Badge></td>
                  <td className="px-3 py-2.5"><span className={cn("font-semibold", (h.percent ?? 0) >= 75 ? "text-emerald-700" : (h.percent ?? 0) >= 50 ? "text-amber-700" : "text-rose-700")}>{pct(h.percent)}</span> <span className="text-xs text-slate-400">({h.score}/{h.total})</span></td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDate(h.completedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="px-3 py-2.5 text-right"><Link to={`/student/results/${h.id}`} className="text-sm font-semibold text-brand-600 hover:underline">Review</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
