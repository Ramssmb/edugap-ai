import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, KeyRound, Globe, Target } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardHeader, PageHeader, PageSkeleton, ErrorState, Button, Field, Input, Select, Textarea, Avatar, Badge } from "@/components/ui";
import { LANGUAGES, formatDate } from "@/lib/utils";

type Profile = {
  role: "student" | "teacher" | "admin";
  name: string;
  email: string;
  createdAt: string;
  grade?: number;
  className?: string | null;
  preferredLanguage?: string;
  dailyQuestionGoal?: number;
  avatarColor?: string;
  department?: string;
  bio?: string;
  classes?: { id: number; name: string }[];
};

export default function Settings() {
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["profile"], queryFn: () => api<Profile>("/profile") });
  const [form, setForm] = useState({ name: "", preferredLanguage: "en", dailyQuestionGoal: "10", department: "", bio: "" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwFields, setPwFields] = useState<Record<string, string>>({});

  // Load the form from the profile whenever a fresh copy arrives (first load, or after saving).
  const [loadedFrom, setLoadedFrom] = useState<Profile | undefined>(undefined);
  if (data && data !== loadedFrom) {
    setLoadedFrom(data);
    setForm({ name: data.name, preferredLanguage: data.preferredLanguage ?? "en", dailyQuestionGoal: String(data.dailyQuestionGoal ?? 10), department: data.department ?? "", bio: data.bio ?? "" });
  }

  const save = useMutation({
    mutationFn: () =>
      api("/profile", {
        method: "PATCH",
        body:
          data?.role === "student"
            ? { name: form.name, preferredLanguage: form.preferredLanguage, dailyQuestionGoal: Number(form.dailyQuestionGoal) }
            : data?.role === "teacher"
              ? { name: form.name, department: form.department, bio: form.bio }
              : { name: form.name },
      }),
    onSuccess: async () => {
      toast.success("Profile saved");
      await refresh();
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["student-dashboard"] });
    },
    onError: (e) => {
      if (e instanceof ApiError) setFields(e.fields);
      toast.error(errorMessage(e));
    },
  });
  const changePw = useMutation({
    mutationFn: () => api("/profile/password", { body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } }),
    onSuccess: () => {
      toast.success("Password changed");
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    },
    onError: (e) => {
      if (e instanceof ApiError) setPwFields(e.fields);
      toast.error(errorMessage(e));
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFields({});
    save.mutate();
  };
  const submitPw = (e: FormEvent) => {
    e.preventDefault();
    setPwFields({});
    if (pw.newPassword !== pw.confirm) return setPwFields({ confirm: "Passwords don't match" });
    changePw.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile & settings" />
      <Card className="flex items-center gap-5 p-6">
        <Avatar name={data.name} color={data.avatarColor ?? "violet"} size="lg" />
        <div className="min-w-0">
          <div className="text-lg font-bold text-ink">{data.name}</div>
          <div className="text-sm text-slate-500">{data.email}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="brand" className="capitalize">{data.role}</Badge>
            {data.className && <Badge>{data.className}</Badge>}
            {data.classes?.map((c) => <Badge key={c.id}>{c.name}</Badge>)}
            <Badge>Joined {formatDate(data.createdAt, { month: "short", year: "numeric" })}</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Profile" icon={<User className="h-5 w-5" />} />
        <form onSubmit={submit} className="space-y-4 p-5 sm:p-6" noValidate>
          <Field label="Full name" htmlFor="s-name" error={fields.name}><Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!fields.name} /></Field>
          {data.role === "student" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred language" htmlFor="s-lang" hint="Used by the AI tutor by default" error={fields.preferredLanguage}>
                <div className="relative">
                  <Globe className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Select id="s-lang" value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })} className="pl-9">
                    {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native} ({l.label})</option>)}
                  </Select>
                </div>
              </Field>
              <Field label="Daily question goal" htmlFor="s-goal" hint="Between 5 and 100" error={fields.dailyQuestionGoal}>
                <div className="relative">
                  <Target className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="s-goal" type="number" min={5} max={100} value={form.dailyQuestionGoal} onChange={(e) => setForm({ ...form, dailyQuestionGoal: e.target.value })} className="pl-9" invalid={!!fields.dailyQuestionGoal} />
                </div>
              </Field>
            </div>
          )}
          {data.role === "teacher" && (
            <>
              <Field label="Department" htmlFor="s-dept" error={fields.department}><Input id="s-dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} invalid={!!fields.department} /></Field>
              <Field label="Bio" htmlFor="s-bio" error={fields.bio}><Textarea id="s-bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} /></Field>
            </>
          )}
          <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save profile</Button></div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Change password" icon={<KeyRound className="h-5 w-5" />} />
        <form onSubmit={submitPw} className="space-y-4 p-5 sm:p-6" noValidate>
          <Field label="Current password" htmlFor="pw-cur" error={pwFields.currentPassword}><Input id="pw-cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} invalid={!!pwFields.currentPassword} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" htmlFor="pw-new" error={pwFields.newPassword} hint="8+ characters, a letter and a number"><Input id="pw-new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} invalid={!!pwFields.newPassword} /></Field>
            <Field label="Confirm new password" htmlFor="pw-confirm" error={pwFields.confirm}><Input id="pw-confirm" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} invalid={!!pwFields.confirm} /></Field>
          </div>
          <div className="flex justify-end"><Button type="submit" variant="secondary" loading={changePw.isPending} disabled={!pw.currentPassword || !pw.newPassword}>Update password</Button></div>
        </form>
      </Card>
    </div>
  );
}
