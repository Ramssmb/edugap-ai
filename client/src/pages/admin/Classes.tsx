import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, School, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Modal, Field, Input, Select, EmptyState, Avatar } from "@/components/ui";

type Cls = { id: number; name: string; grade: number; teacherId: number | null; teacherName: string | null; students: number };
type Teacher = { id: number; name: string; role: string };

function ClassModal({ cls, teachers, onClose }: { cls: Cls | "new"; teachers: Teacher[]; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = cls === "new";
  const [form, setForm] = useState({ name: isNew ? "" : cls.name, grade: String(isNew ? 8 : cls.grade), teacherId: isNew || !cls.teacherId ? "" : String(cls.teacherId) });
  const [fields, setFields] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name, grade: Number(form.grade), teacherId: form.teacherId ? Number(form.teacherId) : null };
      return isNew ? api("/admin/classes", { body }) : api(`/admin/classes/${cls.id}`, { method: "PATCH", body });
    },
    onSuccess: () => {
      toast.success(isNew ? "Class created" : "Class updated");
      void qc.invalidateQueries({ queryKey: ["admin-classes"] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError) setFields(e.fields);
      toast.error(errorMessage(e));
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setFields({});
    save.mutate();
  };
  return (
    <Modal open onClose={onClose} title={isNew ? "New class" : `Edit ${cls.name}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="class-form" loading={save.isPending}>Save</Button></>}>
      <form id="class-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Class name" htmlFor="c-name" error={fields.name}><Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 8-C" invalid={!!fields.name} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Grade" htmlFor="c-grade" error={fields.grade}>
            <Select id="c-grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>{[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select>
          </Field>
          <Field label="Class teacher" htmlFor="c-teacher" error={fields.teacherId}>
            <Select id="c-teacher" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">Unassigned</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminClasses() {
  const [editing, setEditing] = useState<Cls | "new" | null>(null);
  const classes = useQuery({ queryKey: ["admin-classes"], queryFn: () => api<Cls[]>("/admin/classes") });
  const teachers = useQuery({ queryKey: ["admin-users", "teachers"], queryFn: () => api<Teacher[]>("/admin/users?role=teacher") });
  if (classes.isLoading) return <PageSkeleton />;
  if (classes.error || !classes.data) return <ErrorState error={classes.error} onRetry={classes.refetch} />;
  return (
    <div>
      <PageHeader title="Classes" description="Group students into classes and assign a teacher. Teachers can only see students in their own classes." actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New class</Button>} />
      {classes.data.length === 0 ? (
        <Card><EmptyState icon={<School className="h-6 w-6" />} title="No classes yet" action={<Button onClick={() => setEditing("new")}>Create a class</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.data.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><School className="h-5 w-5" /></div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              </div>
              <h3 className="mt-4 text-lg font-bold">{c.name}</h3>
              <p className="text-sm text-slate-500">Grade {c.grade}</p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                {c.teacherName ? <span className="flex items-center gap-2"><Avatar name={c.teacherName} size="sm" color="violet" /> {c.teacherName}</span> : <span className="text-amber-600">No teacher assigned</span>}
                <span className="flex items-center gap-1 text-slate-500"><Users className="h-4 w-4" /> {c.students}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <ClassModal key={editing === "new" ? "new" : editing.id} cls={editing} teachers={teachers.data ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}
