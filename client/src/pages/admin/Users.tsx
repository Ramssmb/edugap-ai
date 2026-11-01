import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserCog, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Input, Select, Modal, Field, Avatar, Badge, EmptyState, Tabs } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

type U = { id: number; name: string; email: string; role: "student" | "teacher" | "admin"; isActive: boolean; createdAt: string; lastLoginAt: string | null; classId: number | null; className: string | null; grade: number | null; department: string | null };
type Cls = { id: number; name: string };

const ROLE_TONE = { student: "brand", teacher: "violet", admin: "amber" } as const;

function UserModal({ user, classes, onClose }: { user: U | "new" | null; classes: Cls[]; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = user === "new";
  const u = isNew ? null : user;
  const [form, setForm] = useState(() => ({
    name: u?.name ?? "",
    email: u?.email ?? "",
    password: "",
    role: u?.role ?? "student",
    classId: u?.classId ? String(u.classId) : "",
    grade: String(u?.grade ?? 8),
    department: u?.department ?? "",
    isActive: u?.isActive ?? true,
  }));
  const [fields, setFields] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      isNew
        ? api("/admin/users", { body: { name: form.name, email: form.email, password: form.password, role: form.role, grade: Number(form.grade), classId: form.classId ? Number(form.classId) : null, department: form.department || undefined } })
        : api(`/admin/users/${u!.id}`, {
            method: "PATCH",
            body: {
              name: form.name,
              role: form.role,
              isActive: form.isActive,
              ...(form.role === "student" ? { classId: form.classId ? Number(form.classId) : null } : {}),
              ...(form.password ? { password: form.password } : {}),
            },
          }),
    onSuccess: () => {
      toast.success(isNew ? "User created" : "User updated");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) setFields(e.fields);
      toast.error(errorMessage(e));
    },
  });
  if (!user) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFields({});
    save.mutate();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Add user" : `Edit ${u!.name}`}
      description={isNew ? "Create a student, teacher or administrator account." : u!.email}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="user-form" loading={save.isPending}>{isNew ? "Create user" : "Save changes"}</Button></>}
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="u-name" error={fields.name}><Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!fields.name} /></Field>
        {isNew && <Field label="Email" htmlFor="u-email" error={fields.email}><Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={!!fields.email} /></Field>}
        <Field label={isNew ? "Password" : "Reset password (optional)"} htmlFor="u-pw" error={fields.password} hint="8+ characters with a letter and a number">
          <Input id="u-pw" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} invalid={!!fields.password} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role" htmlFor="u-role" error={fields.role}>
            <Select id="u-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as U["role"] })}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </Select>
          </Field>
          {form.role === "student" && (
            <Field label="Class" htmlFor="u-class" error={fields.classId}>
              <Select id="u-class" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">No class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          {isNew && form.role === "teacher" && <Field label="Department" htmlFor="u-dept"><Input id="u-dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>}
        </div>
        {!isNew && (
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            <span><span className="font-medium text-ink">Account active</span><span className="block text-xs text-slate-500">Inactive users are signed out immediately and can't sign in.</span></span>
          </label>
        )}
      </form>
    </Modal>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [role, setRole] = useState<"all" | U["role"]>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<U | "new" | null>(null);
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api<U[]>("/admin/users") });
  const classes = useQuery({ queryKey: ["admin-classes"], queryFn: () => api<Cls[]>("/admin/classes") });
  if (users.isLoading) return <PageSkeleton />;
  if (users.error || !users.data) return <ErrorState error={users.error} onRetry={users.refetch} />;
  const rows = users.data.filter((u) => (role === "all" || u.role === role) && (!q.trim() || `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase())));
  const count = (r: U["role"]) => users.data.filter((u) => u.role === r).length;

  return (
    <div>
      <PageHeader title="Users & roles" description="Manage accounts, roles, class membership and access." actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add user</Button>} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={role} onChange={setRole} tabs={[{ value: "all", label: "All", count: users.data.length }, { value: "student", label: "Students", count: count("student") }, { value: "teacher", label: "Teachers", count: count("teacher") }, { value: "admin", label: "Admins", count: count("admin") }]} />
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search users" />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<UsersIcon className="h-6 w-6" />} title="No users match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Class / Dept.</th>
                  <th className="px-4 py-3 font-semibold">Last sign-in</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" color={u.role === "teacher" ? "violet" : u.role === "admin" ? "amber" : "indigo"} />
                        <div><div className="font-semibold text-ink">{u.name}{u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}</div><div className="text-xs text-slate-500">{u.email}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{u.role === "student" ? (u.className ?? "—") : u.role === "teacher" ? (u.department ?? "—") : "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{timeAgo(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      {u.isActive ? <Badge tone="green">Active</Badge> : u.role === "teacher" && !u.lastLoginAt ? <Badge tone="amber">Awaiting approval</Badge> : <Badge tone="red">Deactivated</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(u)}><UserCog className="h-4 w-4" /> Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && <UserModal key={editing === "new" ? "new" : editing.id} user={editing} classes={classes.data ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}
