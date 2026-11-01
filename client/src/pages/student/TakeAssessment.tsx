import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Attempt, ResultDetail } from "@/lib/types";
import { Button, Card, Modal, PageSkeleton, ErrorState, Badge, Progress, SourceBadge, ButtonLink, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const storeKey = (id: string) => `edugap:attempt:${id}`;

function loadSaved(id: string): Record<number, number> {
  try {
    return JSON.parse(sessionStorage.getItem(storeKey(id)) ?? "{}");
  } catch {
    return {};
  }
}

export default function TakeAssessment() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["attempt", id], queryFn: () => api<Attempt>(`/student/attempts/${id}`), retry: false });
  const [answers, setAnswers] = useState<Record<number, number>>(() => loadSaved(id));
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState(false);

  // Answers survive a refresh within the same tab.
  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey(id), JSON.stringify(answers));
    } catch {
      /* storage may be unavailable; answers still live in memory */
    }
  }, [answers, id]);

  const submit = useMutation({
    mutationFn: () =>
      api<ResultDetail>(`/student/attempts/${id}/submit`, {
        body: { answers: (data?.questions ?? []).map((q) => ({ questionId: q.id, selectedIndex: answers[q.id] ?? null })) },
      }),
    onSuccess: (res) => {
      try {
        sessionStorage.removeItem(storeKey(id));
      } catch {
        /* ignore */
      }
      qc.setQueryData(["result", String(res.result.id)], res);
      void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("student") });
      navigate(`/student/results/${res.result.id}`, { replace: true, state: { justSubmitted: true } });
    },
    onError: (e) => {
      setConfirm(false);
      toast.error(errorMessage(e));
    },
  });

  const questions = useMemo(() => data?.questions ?? [], [data]);
  const q = questions[index];
  const answeredCount = questions.filter((x) => answers[x.id] !== undefined).length;
  const unanswered = questions.length - answeredCount;

  const choose = useCallback((qid: number, opt: number) => setAnswers((a) => ({ ...a, [qid]: opt })), []);

  // Keyboard: 1-4 / A-D to answer, arrows to move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q || confirm || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const n = "1234".indexOf(e.key) >= 0 ? Number(e.key) - 1 : "abcd".indexOf(e.key.toLowerCase());
      if (n >= 0 && n < q.options.length) choose(q.id, n);
      else if (e.key === "ArrowRight" && index < questions.length - 1) setIndex((i) => i + 1);
      else if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, index, questions.length, confirm, choose]);

  if (isLoading) return <PageSkeleton />;
  if (error instanceof ApiError && error.status === 409)
    return (
      <Card>
        <EmptyState icon={<Check className="h-6 w-6" />} title="Already submitted" description="This attempt has already been graded. You can find it in your progress history." action={<ButtonLink to="/student/progress">View history</ButtonLink>} />
      </Card>
    );
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;
  if (!q) return <ErrorState error={new Error("This attempt has no questions.")} />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wider text-brand-600 uppercase">{data.assessment.subjectName} · {data.assessment.kind}</div>
          <h1 className="truncate text-xl font-extrabold sm:text-2xl">{data.assessment.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {data.questions.some((x) => x.source === "ai") && <SourceBadge source="ai" />}
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <X className="h-4 w-4" /> Exit
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
          <span>Question {index + 1} of {questions.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <Progress value={(answeredCount / questions.length) * 100} />
      </div>

      <Card className="p-5 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="brand">{q.topicName}</Badge>
          <Badge tone={q.difficulty === "easy" ? "green" : q.difficulty === "medium" ? "amber" : "red"}>{q.difficulty}</Badge>
          {q.source === "ai" && <Badge tone="violet"><Sparkles className="h-3 w-3" /> AI-generated</Badge>}
        </div>
        <h2 className="text-lg leading-relaxed font-semibold sm:text-xl" id="question-prompt">{q.prompt}</h2>
        <div className="mt-6 grid gap-3" role="radiogroup" aria-labelledby="question-prompt">
          {q.options.map((opt, i) => {
            const selected = answers[q.id] === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(q.id, i)}
                className={cn(
                  "group flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition",
                  selected ? "border-brand-500 bg-brand-50/70 shadow-sm" : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50",
                )}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition", selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700")}>
                  {LETTERS[i]}
                </span>
                <span className={cn("text-[15px]", selected ? "font-semibold text-ink" : "text-slate-700")}>{opt}</span>
                {selected && <Check className="ml-auto h-5 w-5 text-brand-600" />}
              </button>
            );
          })}
        </div>
        <p className="mt-4 hidden text-xs text-slate-400 sm:block">Tip: press 1–4 to answer and ← → to move between questions.</p>
      </Card>

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        {index < questions.length - 1 ? (
          <Button onClick={() => setIndex((i) => i + 1)}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => (unanswered ? setConfirm(true) : submit.mutate())} loading={submit.isPending}>
            <Send className="h-4 w-4" /> Submit answers
          </Button>
        )}
      </div>

      <nav className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Jump to question">
        {questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Question ${i + 1}${answers[x.id] !== undefined ? ", answered" : ""}`}
            aria-current={i === index ? "step" : undefined}
            className={cn(
              "h-9 w-9 rounded-lg text-sm font-semibold transition",
              i === index ? "bg-brand-600 text-white shadow" : answers[x.id] !== undefined ? "bg-brand-100 text-brand-800 hover:bg-brand-200" : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit with unanswered questions?"
        description={`You've left ${unanswered} question${unanswered > 1 ? "s" : ""} blank. Blank answers are marked incorrect.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)}>Keep working</Button>
            <Button onClick={() => submit.mutate()} loading={submit.isPending}>Submit anyway</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Blank answers are treated as concepts you haven't understood yet, and they'll show up in your learning plan.</p>
      </Modal>
    </div>
  );
}
