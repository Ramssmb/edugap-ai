import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Gauge, AlertTriangle, ClipboardCheck, ArrowRight, Grid3x3, Lightbulb, TrendingUp, School } from "lucide-react";
import { api } from "@/lib/api";
import type { RosterStudent } from "@/lib/types";
import { Card, CardHeader, PageHeader, PageSkeleton, ErrorState, StatCard, Avatar, Badge, MasteryBar, EmptyState, ButtonLink } from "@/components/ui";
import { CountColumns } from "@/components/charts";
import { pct, masteryColor, cn, statusFor, STATUS_META } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type Overview = {
  classes: { id: number; name: string; grade: number }[];
  stats: { students: number; classAverage: number | null; needsAttention: number; assessmentsThisWeek: number };
  subjects: { id: number; name: string; slug: string; color: string; average: number | null }[];
  topicHeat: { topicId: number; topicName: string; subjectName: string; average: number | null; weak: number; needsImprovement: number; strong: number; assessed: number }[];
  commonWeakConcepts: { concept: string; topicName: string; students: number }[];
  weekly: { week: string; average: number | null; assessments: number }[];
  attention: RosterStudent[];
  roster: RosterStudent[];
};

export default function TeacherOverview() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["teacher-overview"], queryFn: () => api<Overview>("/teacher/overview") });
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  if (data.classes.length === 0)
    return (
      <div>
        <PageHeader title={`Welcome, ${user?.name.split(" ")[0]}`} />
        <Card><EmptyState icon={<School className="h-6 w-6" />} title="No classes assigned yet" description="An administrator needs to assign you to a class. Once they do, your students' progress will appear here." /></Card>
      </div>
    );

  const subjects = [...new Set(data.topicHeat.map((t) => t.subjectName))];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={data.classes.map((c) => c.name).join(" · ")}
        title="Classroom overview"
        description="Live picture of where your class stands, built from every answer your students submit."
        actions={<ButtonLink to="/teacher/assessments"><ClipboardCheck className="h-4 w-4" /> Create assessment</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={data.stats.students} icon={<Users className="h-5 w-5" />} hint={<Link to="/teacher/students" className="font-medium text-brand-600 hover:underline">View roster →</Link>} />
        <StatCard label="Class average mastery" value={pct(data.stats.classAverage)} icon={<Gauge className="h-5 w-5" />} accent="green" />
        <StatCard label="Need attention" value={data.stats.needsAttention} icon={<AlertTriangle className="h-5 w-5" />} accent="rose" hint="Low mastery, declining or inactive" />
        <StatCard label="Assessments this week" value={data.stats.assessmentsThisWeek} icon={<ClipboardCheck className="h-5 w-5" />} accent="violet" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Topic heatmap" description="Class average per topic, and how many students are weak / need work / strong" icon={<Grid3x3 className="h-5 w-5" />} />
          <div className="space-y-5 p-5 sm:p-6">
            {subjects.map((s) => (
              <div key={s}>
                <div className="mb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">{s}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.topicHeat
                    .filter((t) => t.subjectName === s)
                    .map((t) => {
                      const st = statusFor(t.average);
                      return (
                        <div key={t.topicId} className="rounded-xl border p-3" style={{ borderColor: `${masteryColor(t.average)}55`, background: `${masteryColor(t.average)}0f` }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-ink">{t.topicName}</span>
                            <span className="text-sm font-bold text-ink">{pct(t.average)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className={cn("font-medium", st ? STATUS_META[st].text : "text-slate-400")}>{st ? STATUS_META[st].label : "Not assessed"}</span>
                            <span className="flex gap-2 text-slate-500">
                              <span title="Weak"><b className="text-rose-600">{t.weak}</b> weak</span>
                              <span title="Needs improvement"><b className="text-amber-600">{t.needsImprovement}</b> mid</span>
                              <span title="Strong"><b className="text-emerald-600">{t.strong}</b> strong</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Students needing attention" description="Sorted by lowest mastery" icon={<AlertTriangle className="h-5 w-5" />} />
          <div className="p-2 sm:p-3">
            {data.attention.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Everyone is on track. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.attention.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link to={`/teacher/students/${s.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50">
                      <Avatar name={s.name} color={s.avatarColor} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-ink">{s.name}</span>
                          <span className="text-sm font-bold" style={{ color: masteryColor(s.mastery) }}>{pct(s.mastery)}</span>
                        </div>
                        <div className="truncate text-xs text-slate-500">{s.attentionReasons.join(" · ")}</div>
                        {s.weakestTopic?.concept && <div className="truncate text-xs text-slate-600">Gap: {s.weakestTopic.concept} ({s.weakestTopic.name})</div>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Most common misconceptions" description="Concepts the most students are missing" icon={<Lightbulb className="h-5 w-5" />} />
          <ul className="space-y-2 p-5 sm:p-6">
            {data.commonWeakConcepts.length === 0 && <li className="text-sm text-slate-500">No common gaps detected.</li>}
            {data.commonWeakConcepts.map((c) => (
              <li key={`${c.topicName}-${c.concept}`} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{c.concept}</div>
                  <div className="text-xs text-slate-500">{c.topicName}</div>
                </div>
                <Badge tone="red">{c.students} student{c.students > 1 ? "s" : ""}</Badge>
              </li>
            ))}
          </ul>
          <p className="px-6 pb-5 text-xs text-slate-500">Tip: a quick whole-class reteach of the top item often helps several students at once.</p>
        </Card>
        <Card>
          <CardHeader title="Subject averages" description="Mean mastery across assessed students" icon={<Gauge className="h-5 w-5" />} />
          <div className="space-y-4 p-5 sm:p-6">
            {data.subjects.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-24 truncate text-slate-600">{s.name}</span>
                <MasteryBar value={s.average} className="h-1.5 flex-1" />
                <span className="w-10 text-right font-semibold text-ink">{pct(s.average)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Assessment activity" description="Completed assessments per week" icon={<TrendingUp className="h-5 w-5" />} />
          <div className="p-3 sm:p-5">
            <CountColumns data={data.weekly} dataKey="assessments" name="Assessments" labelKey="week" height={200} />
          </div>
          <div className="px-6 pb-5 text-xs text-slate-500">Average score this week: <b className="text-ink">{pct(data.weekly.at(-1)?.average ?? null)}</b></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Class roster" action={<ButtonLink to="/teacher/students" variant="ghost" size="sm">Full roster <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          {data.roster.slice(0, 9).map((s) => (
            <Link key={s.id} to={`/teacher/students/${s.id}`} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-brand-200 hover:bg-brand-50/30">
              <Avatar name={s.name} color={s.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{s.name}</div>
                <MasteryBar value={s.mastery} className="mt-1.5 h-1.5" />
              </div>
              <span className="text-sm font-bold text-ink">{pct(s.mastery)}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
