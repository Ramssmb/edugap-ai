import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, LogIn, UserPlus, BookOpen, FileText, ShieldCheck, Library, KeyRound, Activity as ActivityLucide } from "lucide-react";
import { api } from "@/lib/api";
import { Card, PageHeader, PageSkeleton, ErrorState, Badge, Select, EmptyState } from "@/components/ui";
import { cn, formatDate, timeAgo } from "@/lib/utils";

type Row = { id: number; type: string; message: string; createdAt: string; userName: string | null; userRole: string | null };

const ICONS: Record<string, { icon: React.ReactNode; cls: string }> = {
  assessment: { icon: <ClipboardCheck className="h-4 w-4" />, cls: "bg-brand-50 text-brand-600" },
  login: { icon: <LogIn className="h-4 w-4" />, cls: "bg-slate-100 text-slate-500" },
  register: { icon: <UserPlus className="h-4 w-4" />, cls: "bg-emerald-50 text-emerald-600" },
  lesson: { icon: <BookOpen className="h-4 w-4" />, cls: "bg-sky-50 text-sky-600" },
  assign: { icon: <FileText className="h-4 w-4" />, cls: "bg-violet-50 text-violet-600" },
  admin: { icon: <ShieldCheck className="h-4 w-4" />, cls: "bg-amber-50 text-amber-600" },
  content: { icon: <Library className="h-4 w-4" />, cls: "bg-teal-50 text-teal-600" },
  security: { icon: <KeyRound className="h-4 w-4" />, cls: "bg-rose-50 text-rose-600" },
};

export function ActivityIcon({ type }: { type: string }) {
  const m = ICONS[type] ?? { icon: <ActivityLucide className="h-4 w-4" />, cls: "bg-slate-100 text-slate-500" };
  return <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", m.cls)}>{m.icon}</span>;
}

export default function AdminActivity() {
  const [type, setType] = useState("all");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin-activity", 200], queryFn: () => api<Row[]>("/admin/activity?limit=200"), refetchInterval: 30_000 });
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  const rows = data.filter((r) => type === "all" || r.type === type);
  const types = [...new Set(data.map((r) => r.type))].sort();

  return (
    <div>
      <PageHeader
        title="Platform activity"
        description="The latest 200 events across the platform. Refreshes every 30 seconds."
        actions={
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-48" aria-label="Filter by event type">
            <option value="all">All events</option>
            {types.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<ActivityLucide className="h-6 w-6" />} title="No activity" />
        ) : (
          <ul className="divide-y divide-slate-100 p-2 sm:p-3">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-3">
                <ActivityIcon type={a.type} />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold text-ink">{a.userName ?? "System"}</span> <span className="text-slate-600">{a.message}</span>
                  {a.userRole && <Badge className="ml-2 align-middle">{a.userRole}</Badge>}
                </div>
                <span className="shrink-0 text-xs text-slate-400" title={formatDate(a.createdAt, { dateStyle: "medium", timeStyle: "short" } as Intl.DateTimeFormatOptions)}>{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
