import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, GraduationCap, School, ClipboardCheck, Gauge, Library, Activity, Bot, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader, PageHeader, PageSkeleton, ErrorState, StatCard, MasteryBar, Badge, ButtonLink } from "@/components/ui";
import { CountColumns } from "@/components/charts";
import { pct, timeAgo, STATUS_META, type GapStatus } from "@/lib/utils";
import { ActivityIcon } from "./Activity";

type Stats = {
  users: Partial<Record<"student" | "teacher" | "admin", { total: number; active: number }>>;
  assessments: { total: number; week: number };
  activeStudents: number;
  answers: number;
  content: { subjects: number; topics: number; lessons: number; questions: number; aiQuestions: number };
  platformMastery: number | null;
  subjectMastery: { id: number; name: string; avg: number | null; weak: number }[];
  statusMix: { status: GapStatus; count: number }[];
  daily: { date: string; assessments: number; average: number | null }[];
  aiMode: "ai" | "offline";
};
type ActivityRow = { id: number; type: string; message: string; createdAt: string; userName: string | null; userRole: string | null };

export default function AdminOverview() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => api<Stats>("/admin/stats") });
  const activity = useQuery({ queryKey: ["admin-activity", 8], queryFn: () => api<ActivityRow[]>("/admin/activity?limit=8") });
  if (stats.isLoading) return <PageSkeleton />;
  if (stats.error || !stats.data) return <ErrorState error={stats.error} onRetry={stats.refetch} />;
  const s = stats.data;
  const totalGaps = s.statusMix.reduce((n, x) => n + x.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" description="Usage, learning outcomes and content across EduGap AI." actions={<ButtonLink to="/admin/users" variant="outline"><Users className="h-4 w-4" /> Manage users</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={s.users.student?.total ?? 0} icon={<GraduationCap className="h-5 w-5" />} hint={`${s.activeStudents} active in the last 7 days`} />
        <StatCard label="Teachers" value={s.users.teacher?.total ?? 0} icon={<School className="h-5 w-5" />} accent="violet" hint={`${s.users.admin?.total ?? 0} administrator(s)`} />
        <StatCard label="Assessments completed" value={s.assessments.total} icon={<ClipboardCheck className="h-5 w-5" />} accent="sky" hint={`${s.assessments.week} this week · ${s.answers} answers analysed`} />
        <StatCard label="Platform mastery" value={pct(s.platformMastery)} icon={<Gauge className="h-5 w-5" />} accent="green" hint="Average across all student topics" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Assessments per day" description="Last 14 days" icon={<Activity className="h-5 w-5" />} />
          <div className="p-3 sm:p-5"><CountColumns data={s.daily} dataKey="assessments" name="Assessments" height={240} /></div>
        </Card>
        <Card>
          <CardHeader title="Learning outcomes" description="All student-topic gaps by status" icon={<Gauge className="h-5 w-5" />} />
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white" role="img" aria-label="Gap status distribution">
              {(["strong", "needs_improvement", "weak"] as GapStatus[]).map((k) => {
                const n = s.statusMix.find((x) => x.status === k)?.count ?? 0;
                return <div key={k} className={STATUS_META[k].bar} style={{ width: `${totalGaps ? (n / totalGaps) * 100 : 0}%` }} />;
              })}
            </div>
            {(["strong", "needs_improvement", "weak"] as GapStatus[]).map((k) => {
              const n = s.statusMix.find((x) => x.status === k)?.count ?? 0;
              return (
                <div key={k} className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[k].dot}`} />
                  <span className="flex-1 text-slate-600">{STATUS_META[k].label}</span>
                  <span className="font-semibold text-ink">{n}</span>
                  <span className="w-12 text-right text-xs text-slate-400">{totalGaps ? Math.round((n / totalGaps) * 100) : 0}%</span>
                </div>
              );
            })}
            <div className="border-t border-slate-100 pt-4">
              {s.subjectMastery.map((x) => (
                <div key={x.id} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-sm"><span className="text-slate-600">{x.name}</span><span className="font-semibold text-ink">{pct(x.avg)}</span></div>
                  <MasteryBar value={x.avg} className="mt-1 h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Content library" icon={<Library className="h-5 w-5" />} action={<Link to="/admin/content" className="text-sm font-semibold text-brand-600 hover:underline">Manage</Link>} />
          <dl className="grid grid-cols-2 gap-4 p-5 sm:p-6">
            {[
              ["Subjects", s.content.subjects],
              ["Topics", s.content.topics],
              ["Lessons", s.content.lessons],
              ["Curated questions", s.content.questions],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="font-display text-xl font-extrabold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center gap-2 px-6 pb-5 text-xs text-slate-500">
            <Bot className="h-4 w-4" /> AI engine: {s.aiMode === "ai" ? <Badge tone="violet">Claude enabled</Badge> : <Badge tone="amber">Offline fallback</Badge>} · {s.content.aiQuestions} AI-generated practice questions
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" icon={<Activity className="h-5 w-5" />} action={<ButtonLink to="/admin/activity" variant="ghost" size="sm">View all <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>} />
          <ul className="divide-y divide-slate-100 p-2 sm:p-3">
            {activity.data?.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <ActivityIcon type={a.type} />
                <div className="min-w-0 flex-1 text-sm"><span className="font-semibold text-ink">{a.userName ?? "System"}</span> <span className="text-slate-600">{a.message}</span></div>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
