import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, AlertTriangle, ArrowUpDown, Download } from "lucide-react";
import { api } from "@/lib/api";
import type { RosterStudent } from "@/lib/types";
import { Card, PageHeader, PageSkeleton, ErrorState, Input, Select, Avatar, MasteryBar, Trend, Badge, EmptyState, Button } from "@/components/ui";
import { pct, timeAgo, cn } from "@/lib/utils";

type SortKey = "name" | "mastery" | "trend" | "lastActive";

function downloadCsv(rows: RosterStudent[]) {
  // Quote every cell, and neutralise values Excel would run as a formula (CSV injection).
  const esc = (v: unknown) => {
    const raw = String(v ?? "");
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ["Name", "Email", "Class", "Mastery %", "Assessments", "Trend", "Weakest topic", "Weakest concept", "Needs attention", "Reasons"];
  const lines = rows.map((s) => [s.name, s.email, s.className, s.mastery?.toFixed(1), s.assessments, s.trend, s.weakestTopic?.name, s.weakestTopic?.concept, s.needsAttention ? "Yes" : "No", s.attentionReasons.join("; ")].map(esc).join(","));
  const blob = new Blob([[header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `edugap-roster-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function TeacherStudents() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["teacher-students"], queryFn: () => api<RosterStudent[]>("/teacher/students") });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "weak">("all");
  const [cls, setCls] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "mastery", dir: 1 });
  const classes = useMemo(() => [...new Set((data ?? []).map((s) => s.className).filter(Boolean))] as string[], [data]);

  const rows = useMemo(() => {
    const r = (data ?? []).filter(
      (s) =>
        (!q.trim() || `${s.name} ${s.email}`.toLowerCase().includes(q.trim().toLowerCase())) &&
        (filter === "all" || (filter === "attention" ? s.needsAttention : s.weakCount > 0)) &&
        (cls === "all" || s.className === cls),
    );
    const val = (s: RosterStudent) => (sort.key === "name" ? s.name : sort.key === "mastery" ? (s.mastery ?? -1) : sort.key === "trend" ? (s.trend ?? -999) : s.lastActive ? new Date(s.lastActive).getTime() : 0);
    return r.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
    });
  }, [data, q, filter, cls, sort]);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const th = (key: SortKey, label: string) => (
    <th className="px-4 py-3 font-semibold">
      <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))} aria-label={`Sort by ${label}`}>
        {label} <ArrowUpDown className={cn("h-3 w-3", sort.key === key ? "text-brand-600" : "text-slate-300")} />
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${data.length} students · ${data.filter((s) => s.needsAttention).length} need attention`}
        actions={<Button variant="outline" onClick={() => downloadCsv(rows)} disabled={!rows.length}><Download className="h-4 w-4" /> Export CSV</Button>}
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="pl-9" aria-label="Search students" />
          </div>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="sm:w-52" aria-label="Filter students">
            <option value="all">All students</option>
            <option value="attention">Needs attention</option>
            <option value="weak">Has weak topics</option>
          </Select>
          {classes.length > 1 && (
            <Select value={cls} onChange={(e) => setCls(e.target.value)} className="sm:w-40" aria-label="Filter by class">
              <option value="all">All classes</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No students match" description={data.length ? "Try clearing the filters." : "No students are in your classes yet."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                <tr>
                  {th("name", "Student")}
                  {th("mastery", "Mastery")}
                  <th className="px-4 py-3 font-semibold">Weakest area</th>
                  {th("trend", "Trend")}
                  {th("lastActive", "Last active")}
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <tr key={s.id} className="group hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <Link to={`/teacher/students/${s.id}`} className="flex items-center gap-3">
                        <Avatar name={s.name} color={s.avatarColor} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-ink group-hover:text-brand-700">{s.name}</div>
                          <div className="text-xs text-slate-500">{s.className ?? "—"} · {s.assessments} assessments</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex w-36 items-center gap-2">
                        <MasteryBar value={s.mastery} className="h-1.5 flex-1" />
                        <span className="w-10 text-right font-semibold text-ink">{pct(s.mastery)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.weakestTopic ? (
                        <div>
                          <div className="text-ink">{s.weakestTopic.name} <span className="text-xs text-slate-500">({Math.round(s.weakestTopic.mastery)}%)</span></div>
                          {s.weakestTopic.concept && <div className="text-xs text-slate-500">{s.weakestTopic.concept}</div>}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3"><Trend value={s.trend} /></td>
                    <td className="px-4 py-3 text-slate-600">{timeAgo(s.lastActive)}</td>
                    <td className="px-4 py-3">
                      {s.needsAttention ? (
                        <Badge tone="red" className="max-w-[200px]"><AlertTriangle className="h-3 w-3 shrink-0" /><span className="truncate" title={s.attentionReasons.join(", ")}>{s.attentionReasons[0]}</span></Badge>
                      ) : (
                        <Badge tone="green">On track</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
