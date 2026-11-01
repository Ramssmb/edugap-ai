import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Trash2, ArrowRight, Users, CalendarClock, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Subject } from "@/lib/types";
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Modal, Field, Input, Select, Badge, EmptyState, Progress } from "@/components/ui";
import { cn, dueLabel, formatDate, pct, subjectColor } from "@/lib/utils";

type Row = { id: number; title: string; dueAt: string | null; createdAt: string; questionCount: number; className: string | null; subjectName: string; subjectSlug: string; subjectColor: string; completedBy: number; classSize: number; averageScore: number | null };
type BankQ = { id: number; prompt: string; concept: string; difficulty: string; topicId: number; topicName: string };

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => api<Subject[]>("/catalog/subjects"), enabled: open });
  const overview = useQuery({ queryKey: ["teacher-overview"], queryFn: () => api<{ classes: { id: number; name: string }[] }>("/teacher/overview"), enabled: open });
  const [form, setForm] = useState({ title: "", classId: "", subjectId: "", topicIds: [] as number[], questionCount: 6, dueAt: "", manual: false, questionIds: [] as number[] });
  const [fields, setFields] = useState<Record<string, string>>({});
  const subject = subjects.data?.find((s) => String(s.id) === form.subjectId);
  const bank = useQuery({
    queryKey: ["bank", form.topicIds.join(",")],
    queryFn: () => api<BankQ[]>(`/teacher/questions?topicIds=${form.topicIds.join(",")}`),
    enabled: open && form.manual && form.topicIds.length > 0,
  });

  const create = useMutation({
    mutationFn: () =>
      api("/teacher/assessments", {
        body: {
          title: form.title,
          classId: Number(form.classId) || 0,
          subjectId: Number(form.subjectId) || 0,
          topicIds: form.topicIds,
          questionCount: form.manual ? Math.max(3, form.questionIds.length) : form.questionCount,
          questionIds: form.manual ? form.questionIds : undefined,
          dueAt: form.dueAt ? new Date(form.dueAt + "T23:59:00").toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Assessment assigned to your class");
      void qc.invalidateQueries({ queryKey: ["teacher-assessments"] });
      setForm({ title: "", classId: "", subjectId: "", topicIds: [], questionCount: 6, dueAt: "", manual: false, questionIds: [] });
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
    if (form.manual && form.questionIds.length < 3) return setFields({ questionIds: "Pick at least 3 questions" });
    create.mutate();
  };
  const toggleTopic = (id: number) => setForm((f) => ({ ...f, topicIds: f.topicIds.includes(id) ? f.topicIds.filter((t) => t !== id) : [...f.topicIds, id], questionIds: [] }));
  const toggleQ = (id: number) => setForm((f) => ({ ...f, questionIds: f.questionIds.includes(id) ? f.questionIds.filter((q) => q !== id) : [...f.questionIds, id] }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Create assessment"
      description="Choose topics; EduGap picks a balanced mix of easy, medium and hard questions — or choose them yourself."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="create-assessment" loading={create.isPending}>Assign to class</Button>
        </>
      }
    >
      <form id="create-assessment" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="a-title" error={fields.title}>
          <Input id="a-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fractions weekly check" invalid={!!fields.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Class" htmlFor="a-class" error={fields.classId}>
            <Select id="a-class" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} invalid={!!fields.classId}>
              <option value="">Choose…</option>
              {overview.data?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Subject" htmlFor="a-subject" error={fields.subjectId}>
            <Select id="a-subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicIds: [], questionIds: [] })} invalid={!!fields.subjectId}>
              <option value="">Choose…</option>
              {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Due date (optional)" htmlFor="a-due" error={fields.dueAt}>
            <Input id="a-due" type="date" min={today} value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          </Field>
        </div>
        {subject && (
          <Field label="Topics" error={fields.topicIds}>
            <div className="flex flex-wrap gap-2">
              {subject.topics.map((t) => {
                const on = form.topicIds.includes(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => toggleTopic(t.id)} aria-pressed={on} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition", on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        {form.topicIds.length > 0 && (
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input type="checkbox" checked={form.manual} onChange={(e) => setForm({ ...form, manual: e.target.checked, questionIds: [] })} className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
                Choose questions myself
              </label>
              {!form.manual && (
                <div className="flex items-center gap-2 text-sm">
                  <label htmlFor="a-count" className="text-slate-600">Questions</label>
                  <Input id="a-count" type="number" min={3} max={30} value={form.questionCount} onChange={(e) => setForm({ ...form, questionCount: Number(e.target.value) })} className="w-20 py-1.5" invalid={!!fields.questionCount} />
                </div>
              )}
            </div>
            {fields.questionCount && <p className="mt-1 text-xs text-rose-600">{fields.questionCount}</p>}
            {form.manual && (
              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
                {bank.isLoading && <p className="text-sm text-slate-500">Loading question bank…</p>}
                {bank.data?.map((q) => (
                  <label key={q.id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 text-sm transition", form.questionIds.includes(q.id) ? "border-brand-300 bg-brand-50/50" : "border-slate-100 hover:bg-slate-50")}>
                    <input type="checkbox" checked={form.questionIds.includes(q.id)} onChange={() => toggleQ(q.id)} className="mt-0.5 h-4 w-4 accent-brand-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-ink">{q.prompt}</span>
                      <span className="mt-1 flex flex-wrap gap-1"><Badge>{q.topicName}</Badge><Badge tone="brand">{q.concept}</Badge><Badge tone={q.difficulty === "easy" ? "green" : q.difficulty === "medium" ? "amber" : "red"}>{q.difficulty}</Badge></span>
                    </span>
                  </label>
                ))}
                <p className={cn("pt-1 text-xs", fields.questionIds ? "text-rose-600" : "text-slate-500")}>{fields.questionIds ?? `${form.questionIds.length} selected (minimum 3)`}</p>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function TeacherAssessments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["teacher-assessments"], queryFn: () => api<Row[]>("/teacher/assessments") });
  const del = useMutation({
    mutationFn: (id: number) => api(`/teacher/assessments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Assessment deleted");
      setToDelete(null);
      void qc.invalidateQueries({ queryKey: ["teacher-assessments"] });
    },
    onError: (e) => {
      setToDelete(null);
      toast.error(errorMessage(e));
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Assessments" description="Create assessments for your class and see results question by question." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create assessment</Button>} />
      {data.length === 0 ? (
        <Card><EmptyState icon={<FileText className="h-6 w-6" />} title="No assessments yet" description="Create one to check your class's understanding of specific topics." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create assessment</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((a) => {
            const due = dueLabel(a.dueAt);
            const c = subjectColor(a.subjectColor);
            return (
              <Card key={a.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", c.soft, c.fg)}>{a.subjectName}</span>
                    <h3 className="mt-2 truncate font-bold text-ink">{a.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {a.className}</span>
                      <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> {a.questionCount} questions</span>
                      <span className={cn("inline-flex items-center gap-1", due.tone)}><CalendarClock className="h-3.5 w-3.5" /> {due.text}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setToDelete(a)} aria-label={`Delete ${a.title}`} title={a.completedBy ? "Can't delete — students have taken it" : "Delete"} disabled={a.completedBy > 0}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500"><span>{a.completedBy} of {a.classSize} completed</span><span>Avg score <b className="text-ink">{pct(a.averageScore)}</b></span></div>
                  <Progress value={(a.completedBy / Math.max(1, a.classSize)) * 100} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Created {formatDate(a.createdAt, { day: "numeric", month: "short" })}</span>
                  <Link to={`/teacher/assessments/${a.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">View results <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <CreateModal open={open} onClose={() => setOpen(false)} />
      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete assessment?"
        description={toDelete ? `"${toDelete.title}" will be removed for all students. This can't be undone.` : ""}
        footer={<><Button variant="outline" onClick={() => setToDelete(null)}>Cancel</Button><Button variant="danger" loading={del.isPending} onClick={() => toDelete && del.mutate(toDelete.id)}>Delete</Button></>}
      >
        <p className="text-sm text-slate-600">Only assessments no student has started can be deleted, so no student data is lost.</p>
      </Modal>
    </div>
  );
}
