import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, BookOpen, HelpCircle, Library, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Subject, Topic } from "@/lib/types";
import { Card, CardHeader, PageHeader, PageSkeleton, ErrorState, Button, Modal, Field, Input, Select, Textarea, Badge, EmptyState } from "@/components/ui";
import { cn, subjectColor } from "@/lib/utils";

type LessonRow = { id: number; title: string; summary: string; durationMinutes: number; topicId: number };
type LessonFull = LessonRow & { content: string; keyPoints: string[]; example: string; level: string };
type Question = { id: number; concept: string; difficulty: "easy" | "medium" | "hard"; prompt: string; options: string[]; correctIndex: number; explanation: string; source: "ai" | "rules" };

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["subjects"] });
    void qc.invalidateQueries({ queryKey: ["lessons"] });
    void qc.invalidateQueries({ queryKey: ["admin-questions"] });
    void qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };
}

function useSave<T>(fn: (body: T) => Promise<unknown>, done: string, onDone: () => void) {
  const invalidate = useInvalidate();
  const [fields, setFields] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(done);
      invalidate();
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError) setFields(e.fields);
      toast.error(errorMessage(e));
    },
  });
  return { ...m, fields, reset: () => setFields({}) };
}

function NameModal({ title, initial, onSave, onClose, pending, fields, withColor }: { title: string; initial?: { name: string; description: string; color?: string }; onSave: (v: { name: string; description: string; color?: string }) => void; onClose: () => void; pending: boolean; fields: Record<string, string>; withColor?: boolean }) {
  const [v, setV] = useState({ name: initial?.name ?? "", description: initial?.description ?? "", color: initial?.color ?? "indigo" });
  return (
    <Modal open onClose={onClose} title={title} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="name-form" loading={pending}>Save</Button></>}>
      <form id="name-form" className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); onSave(withColor ? v : { name: v.name, description: v.description }); }}>
        <Field label="Name" htmlFor="n-name" error={fields.name}><Input id="n-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} invalid={!!fields.name} /></Field>
        <Field label="Description" htmlFor="n-desc" error={fields.description}><Textarea id="n-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={3} /></Field>
        {withColor && (
          <Field label="Colour">
            <div className="flex flex-wrap gap-2">
              {["indigo", "emerald", "violet", "sky", "amber", "rose", "teal"].map((c) => (
                <button key={c} type="button" onClick={() => setV({ ...v, color: c })} aria-label={c} aria-pressed={v.color === c} className={cn("h-8 w-8 rounded-full ring-offset-2 transition", subjectColor(c).bg, v.color === c && "ring-2 ring-ink")} />
              ))}
            </div>
          </Field>
        )}
      </form>
    </Modal>
  );
}

function LessonModal({ topicId, lessonId, onClose }: { topicId: number; lessonId: number | "new"; onClose: () => void }) {
  const existing = useQuery({ queryKey: ["admin-lesson", lessonId], queryFn: () => api<LessonFull>(`/admin/lessons/${lessonId}`), enabled: lessonId !== "new" });
  const [v, setV] = useState({ title: "", summary: "", content: "", keyPoints: "", example: "", durationMinutes: "10", level: "easy" });
  // Fill the form once the lesson being edited has loaded.
  const [loadedFrom, setLoadedFrom] = useState<LessonFull | undefined>(undefined);
  if (existing.data && existing.data !== loadedFrom) {
    setLoadedFrom(existing.data);
    setV({ title: existing.data.title, summary: existing.data.summary, content: existing.data.content, keyPoints: existing.data.keyPoints.join("\n"), example: existing.data.example, durationMinutes: String(existing.data.durationMinutes), level: existing.data.level });
  }
  const save = useSave(
    (body: Record<string, unknown>) => (lessonId === "new" ? api("/admin/lessons", { body }) : api(`/admin/lessons/${lessonId}`, { method: "PATCH", body })),
    lessonId === "new" ? "Lesson published" : "Lesson updated",
    onClose,
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.reset();
    save.mutate({ topicId, title: v.title, summary: v.summary, content: v.content, keyPoints: v.keyPoints.split("\n").map((s) => s.trim()).filter(Boolean), example: v.example, durationMinutes: Number(v.durationMinutes), level: v.level });
  };
  const f = save.fields;
  return (
    <Modal open size="lg" onClose={onClose} title={lessonId === "new" ? "New lesson" : "Edit lesson"} description="Use '## ' for headings and '- ' for bullet points." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="lesson-form" loading={save.isPending} disabled={lessonId !== "new" && !existing.data}>Save lesson</Button></>}>
      <form id="lesson-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="l-title" error={f.title}><Input id="l-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} invalid={!!f.title} /></Field>
        <Field label="Summary" htmlFor="l-sum" error={f.summary}><Textarea id="l-sum" rows={2} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} invalid={!!f.summary} /></Field>
        <Field label="Content" htmlFor="l-content" error={f.content}><Textarea id="l-content" rows={10} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} invalid={!!f.content} className="font-mono text-xs" /></Field>
        <Field label="Key points (one per line)" htmlFor="l-kp" error={f.keyPoints}><Textarea id="l-kp" rows={4} value={v.keyPoints} onChange={(e) => setV({ ...v, keyPoints: e.target.value })} /></Field>
        <Field label="Worked example" htmlFor="l-ex" error={f.example}><Textarea id="l-ex" rows={2} value={v.example} onChange={(e) => setV({ ...v, example: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duration (minutes)" htmlFor="l-dur" error={f.durationMinutes}><Input id="l-dur" type="number" min={1} max={120} value={v.durationMinutes} onChange={(e) => setV({ ...v, durationMinutes: e.target.value })} /></Field>
          <Field label="Level" htmlFor="l-level"><Select id="l-level" value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })}><option value="easy">Beginner</option><option value="medium">Intermediate</option><option value="hard">Advanced</option></Select></Field>
        </div>
      </form>
    </Modal>
  );
}

function QuestionModal({ topicId, onClose }: { topicId: number; onClose: () => void }) {
  const [v, setV] = useState({ prompt: "", options: ["", "", "", ""], correctIndex: 0, concept: "", difficulty: "easy", explanation: "" });
  const save = useSave((body: Record<string, unknown>) => api("/admin/questions", { body }), "Question added", onClose);
  const f = save.fields;
  return (
    <Modal open size="lg" onClose={onClose} title="Add question" description="Tag it with the exact concept it tests — that's what powers gap detection." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="q-form" loading={save.isPending}>Add question</Button></>}>
      <form id="q-form" className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); save.reset(); save.mutate({ topicId, ...v }); }}>
        <Field label="Question" htmlFor="q-prompt" error={f.prompt}><Textarea id="q-prompt" rows={2} value={v.prompt} onChange={(e) => setV({ ...v, prompt: e.target.value })} invalid={!!f.prompt} /></Field>
        <fieldset>
          <legend className="label">Options — select the correct one</legend>
          <div className="space-y-2">
            {v.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={v.correctIndex === i} onChange={() => setV({ ...v, correctIndex: i })} className="h-4 w-4 accent-emerald-600" aria-label={`Option ${i + 1} is correct`} />
                <Input value={o} onChange={(e) => setV({ ...v, options: v.options.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Option ${String.fromCharCode(65 + i)}`} aria-label={`Option ${i + 1}`} invalid={!!f.options || !!f[`options.${i}`]} />
              </div>
            ))}
          </div>
          {(() => {
            // An empty option is the more useful message than "must be different".
            const itemKey = Object.keys(f).find((k) => k.startsWith("options."));
            const msg = (itemKey && f[itemKey]) || f.options || f.correctIndex;
            return msg ? <p className="mt-1.5 text-xs text-rose-600">{msg}</p> : null;
          })()}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Concept tested" htmlFor="q-concept" error={f.concept}><Input id="q-concept" value={v.concept} onChange={(e) => setV({ ...v, concept: e.target.value })} placeholder="e.g. Dividing fractions" invalid={!!f.concept} /></Field>
          <Field label="Difficulty" htmlFor="q-diff"><Select id="q-diff" value={v.difficulty} onChange={(e) => setV({ ...v, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
        </div>
        <Field label="Explanation" htmlFor="q-exp" error={f.explanation}><Textarea id="q-exp" rows={2} value={v.explanation} onChange={(e) => setV({ ...v, explanation: e.target.value })} invalid={!!f.explanation} /></Field>
      </form>
    </Modal>
  );
}

export default function AdminContent() {
  const invalidate = useInvalidate();
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => api<Subject[]>("/catalog/subjects") });
  const lessons = useQuery({ queryKey: ["lessons"], queryFn: () => api<LessonRow[]>("/catalog/lessons") });
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [modal, setModal] = useState<null | { kind: "subject" | "topic"; edit?: Topic | Subject } | { kind: "lesson"; id: number | "new" } | { kind: "question" }>(null);
  const [confirm, setConfirm] = useState<null | { label: string; path: string }>(null);
  const subject = subjects.data?.find((s) => s.id === subjectId) ?? subjects.data?.[0];
  const topic = subject?.topics.find((t) => t.id === topicId) ?? subject?.topics[0];
  const questions = useQuery({ queryKey: ["admin-questions", topic?.id], queryFn: () => api<Question[]>(`/admin/questions?topicId=${topic!.id}`), enabled: !!topic });

  const saveSubject = useSave((b: Record<string, unknown>) => (modal && "edit" in modal && modal.edit ? api(`/admin/subjects/${modal.edit.id}`, { method: "PATCH", body: b }) : api("/admin/subjects", { body: b })), "Subject saved", () => setModal(null));
  const saveTopic = useSave((b: Record<string, unknown>) => (modal && "edit" in modal && modal.edit ? api(`/admin/topics/${modal.edit.id}`, { method: "PATCH", body: b }) : api("/admin/topics", { body: { ...b, subjectId: subject!.id } })), "Topic saved", () => setModal(null));
  const remove = useMutation({
    mutationFn: (path: string) => api(path, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Deleted");
      setConfirm(null);
      invalidate();
    },
    onError: (e) => {
      setConfirm(null);
      toast.error(errorMessage(e));
    },
  });

  if (subjects.isLoading) return <PageSkeleton />;
  if (subjects.error || !subjects.data) return <ErrorState error={subjects.error} onRetry={subjects.refetch} />;
  const topicLessons = (lessons.data ?? []).filter((l) => l.topicId === topic?.id);

  return (
    <div>
      <PageHeader title="Subjects & learning materials" description="Manage the curriculum: subjects, topics, lessons and the question bank." actions={<Button onClick={() => setModal({ kind: "subject" })}><Plus className="h-4 w-4" /> Add subject</Button>} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-3">
          <div className="px-2 pb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">Subjects</div>
          {subjects.data.map((s) => (
            <button key={s.id} type="button" onClick={() => { setSubjectId(s.id); setTopicId(null); }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition", subject?.id === s.id ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 hover:bg-slate-50")}>
              <span className={cn("h-2.5 w-2.5 rounded-full", subjectColor(s.color).bg)} />
              <span className="flex-1 truncate">{s.name}</span>
              <span className="text-xs text-slate-400">{s.topics.length}</span>
            </button>
          ))}
        </Card>

        {subject && (
          <div className="space-y-6">
            <Card>
              <CardHeader
                title={subject.name}
                description={subject.description || "No description"}
                icon={<Library className="h-5 w-5" />}
                action={
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setModal({ kind: "subject", edit: subject })}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setConfirm({ label: `subject "${subject.name}"`, path: `/admin/subjects/${subject.id}` })}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                }
              />
              <div className="flex flex-wrap gap-2 p-5 sm:p-6">
                {subject.topics.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTopicId(t.id)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium transition", topic?.id === t.id ? "border-brand-500 bg-brand-600 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                    {t.name}
                  </button>
                ))}
                <Button size="sm" variant="soft" onClick={() => setModal({ kind: "topic" })}><FolderPlus className="h-4 w-4" /> Add topic</Button>
              </div>
            </Card>

            {topic ? (
              <>
                <Card>
                  <CardHeader
                    title={`Lessons · ${topic.name}`}
                    icon={<BookOpen className="h-5 w-5" />}
                    action={
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setModal({ kind: "topic", edit: topic })}><Pencil className="h-3.5 w-3.5" /> Topic</Button>
                        <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirm({ label: `topic "${topic.name}"`, path: `/admin/topics/${topic.id}` })} aria-label="Delete topic"><Trash2 className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" onClick={() => setModal({ kind: "lesson", id: "new" })}><Plus className="h-3.5 w-3.5" /> Lesson</Button>
                      </div>
                    }
                  />
                  <ul className="divide-y divide-slate-100 p-2 sm:p-3">
                    {topicLessons.length === 0 && <li className="p-3 text-sm text-slate-500">No lessons yet — students won't get a lesson recommendation for this topic until you add one.</li>}
                    {topicLessons.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 px-3 py-3">
                        <div className="min-w-0 flex-1"><div className="font-semibold text-ink">{l.title}</div><div className="truncate text-xs text-slate-500">{l.summary}</div></div>
                        <Badge>{l.durationMinutes} min</Badge>
                        <Button size="icon" variant="ghost" onClick={() => setModal({ kind: "lesson", id: l.id })} aria-label={`Edit ${l.title}`}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirm({ label: `lesson "${l.title}"`, path: `/admin/lessons/${l.id}` })} aria-label={`Delete ${l.title}`}><Trash2 className="h-4 w-4" /></Button>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card>
                  <CardHeader title={`Question bank · ${topic.name}`} description={questions.data ? `${questions.data.filter((q) => q.source === "rules").length} curated · ${questions.data.filter((q) => q.source === "ai").length} AI-generated` : undefined} icon={<HelpCircle className="h-5 w-5" />} action={<Button size="sm" onClick={() => setModal({ kind: "question" })}><Plus className="h-3.5 w-3.5" /> Question</Button>} />
                  <ul className="divide-y divide-slate-100 p-2 sm:p-3">
                    {questions.isLoading && <li className="p-3 text-sm text-slate-500">Loading…</li>}
                    {questions.data?.length === 0 && <li className="p-3 text-sm text-slate-500">No questions yet.</li>}
                    {questions.data?.map((q) => (
                      <li key={q.id} className="flex items-start gap-3 px-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-ink">{q.prompt}</div>
                          <div className="mt-1 text-xs text-emerald-700">✓ {q.options[q.correctIndex]}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1"><Badge tone="brand">{q.concept}</Badge><Badge tone={q.difficulty === "easy" ? "green" : q.difficulty === "medium" ? "amber" : "red"}>{q.difficulty}</Badge>{q.source === "ai" && <Badge tone="violet">AI-generated</Badge>}</div>
                        </div>
                        <Button size="icon" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirm({ label: "this question", path: `/admin/questions/${q.id}` })} aria-label="Delete question"><Trash2 className="h-4 w-4" /></Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            ) : (
              <Card><EmptyState icon={<FolderPlus className="h-6 w-6" />} title="No topics yet" description="Add a topic to start adding lessons and questions." action={<Button onClick={() => setModal({ kind: "topic" })}>Add topic</Button>} /></Card>
            )}
          </div>
        )}
      </div>

      {modal?.kind === "subject" && <NameModal withColor title={modal.edit ? "Edit subject" : "Add subject"} initial={modal.edit as Subject | undefined} onClose={() => setModal(null)} pending={saveSubject.isPending} fields={saveSubject.fields} onSave={(v) => saveSubject.mutate(v)} />}
      {modal?.kind === "topic" && <NameModal title={modal.edit ? "Edit topic" : `Add topic to ${subject?.name}`} initial={modal.edit as Topic | undefined} onClose={() => setModal(null)} pending={saveTopic.isPending} fields={saveTopic.fields} onSave={(v) => saveTopic.mutate(v)} />}
      {modal?.kind === "lesson" && topic && <LessonModal topicId={topic.id} lessonId={modal.id} onClose={() => setModal(null)} />}
      {modal?.kind === "question" && topic && <QuestionModal topicId={topic.id} onClose={() => setModal(null)} />}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete permanently?" description={confirm ? `This will delete ${confirm.label}.` : ""} footer={<><Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" loading={remove.isPending} onClick={() => confirm && remove.mutate(confirm.path)}>Delete</Button></>}>
        <p className="text-sm text-slate-600">Content that students have already answered can't be deleted, so no learning history is lost. You'll see a message if that applies.</p>
      </Modal>
    </div>
  );
}
