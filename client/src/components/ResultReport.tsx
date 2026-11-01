import { useState } from "react";
import { CheckCircle2, XCircle, Target, ArrowRight, Sparkles, BookOpen, ChevronDown, MinusCircle, PartyPopper } from "lucide-react";
import type { ResultDetail } from "@/lib/types";
import { Card, CardHeader, Badge, StatusBadge, MasteryBar, Trend, Tabs, ButtonLink, Button } from "@/components/ui";
import { cn, formatDate, STATUS_META } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function ScoreHero({ r, celebrate }: { r: ResultDetail["result"]; celebrate?: boolean }) {
  const p = r.percent;
  const tone = p >= 75 ? "from-emerald-500 to-teal-500" : p >= 50 ? "from-amber-500 to-orange-500" : "from-rose-500 to-pink-500";
  const msg = p >= 90 ? "Outstanding work!" : p >= 75 ? "Great job — strong understanding." : p >= 50 ? "Good effort — a few concepts to strengthen." : "This shows us exactly what to work on next.";
  const minutes = Math.max(1, Math.round((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 60000));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className={cn("flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-lg", tone)}>
          <span className="font-display text-4xl font-extrabold">{Math.round(p)}%</span>
          <span className="text-xs font-semibold opacity-90">{r.score} / {r.total}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold tracking-wider text-brand-600 uppercase">{r.subjectName} · {r.kind}</div>
          <h1 className="mt-1 text-2xl font-extrabold">{r.title}</h1>
          <p className="mt-1 flex items-center gap-2 text-slate-600">
            {celebrate && p >= 75 && <PartyPopper className="h-4 w-4 text-amber-500" />} {msg}
          </p>
          <p className="mt-2 text-xs text-slate-500">Completed {formatDate(r.completedAt, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })} · about {minutes} min</p>
        </div>
      </div>
      <div className="grid border-t border-slate-100 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
        {r.topicBreakdown.map((t) => (
          <div key={t.topicId} className="border-b border-slate-100 px-6 py-4 sm:border-r sm:border-b-0 last:border-r-0">
            <div className="truncate text-xs font-medium text-slate-500">{t.topicName}</div>
            <div className="mt-0.5 font-display text-lg font-bold text-ink">{t.correct}/{t.total}</div>
            <MasteryBar value={t.percent} className="mt-1.5 h-1.5" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ResultReport({ detail, audience, onPractice, practising, celebrate }: { detail: ResultDetail; audience: "student" | "teacher"; onPractice?: (topicId: number) => void; practising?: number | null; celebrate?: boolean }) {
  const [filter, setFilter] = useState<"all" | "wrong" | "right">(detail.missedConcepts.length ? "wrong" : "all");
  const [openQ, setOpenQ] = useState<number | null>(null);
  const before = new Map((detail.before ?? []).map((b) => [b.topicId, b.mastery]));
  const you = audience === "student";
  const shown = detail.answers.filter((a) => (filter === "all" ? true : filter === "wrong" ? !a.isCorrect : a.isCorrect));

  return (
    <div className="space-y-6">
      <ScoreHero r={detail.result} celebrate={celebrate} />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title={you ? "What you don't understand yet" : "Concepts missed in this attempt"}
            description="The exact concepts behind each incorrect answer"
            icon={<Target className="h-5 w-5" />}
          />
          <div className="p-5 sm:p-6">
            {detail.missedConcepts.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5" /> No gaps in this attempt — every concept was answered correctly.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {detail.missedConcepts.map((m) => (
                  <li key={`${m.topicName}-${m.concept}`} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3">
                    <XCircle className="h-5 w-5 shrink-0 text-rose-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">{m.concept}</div>
                      <div className="text-xs text-slate-500">{m.topicName}</div>
                    </div>
                    <span className="text-xs font-semibold text-rose-700">missed {m.missed} of {m.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Topic mastery now" description={detail.before ? "Before → after this attempt" : "As of today"} />
          <div className="space-y-4 p-5 sm:p-6">
            {detail.gaps.map((g) => {
              // Before → after is only meaningful right after submitting; for an older result the
              // stored previous value belongs to a later attempt, so just show current mastery.
              const prev = detail.before ? (before.get(g.topicId) ?? null) : undefined;
              return (
                <div key={g.topicId}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{g.topicName}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <MasteryBar value={g.mastery} className="flex-1" />
                    <span className="text-sm font-bold text-ink">{Math.round(g.mastery)}%</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {prev === undefined ? (
                      "Current mastery from all your recent answers"
                    ) : prev !== null ? (
                      <span className="inline-flex items-center gap-2">was {Math.round(prev)}% <Trend value={g.mastery - prev} /></span>
                    ) : (
                      "First assessment on this topic"
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {detail.recommendations.length > 0 && (
        <Card className="border-brand-200">
          <CardHeader title={you ? "Your next steps" : "Recommended next steps"} description="Generated from the gaps above — updated automatically after every attempt" icon={<Sparkles className="h-5 w-5" />} />
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
            {detail.recommendations.slice(0, 4).map((r) => (
              <div key={r.id} className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <Badge tone={r.type === "lesson" ? "brand" : "violet"} className="self-start">{r.type === "lesson" ? <><BookOpen className="h-3 w-3" /> Lesson</> : <><Sparkles className="h-3 w-3" /> Practice</>}</Badge>
                <div className="mt-2 text-sm font-semibold text-ink">{r.title}</div>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600">{r.reason}</p>
                {you &&
                  (r.type === "lesson" && r.lessonId ? (
                    <ButtonLink to={`/student/lessons/${r.lessonId}`} size="sm" className="mt-3 self-start">Study lesson <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>
                  ) : (
                    onPractice && (
                      <Button size="sm" variant="soft" className="mt-3 self-start" onClick={() => onPractice(r.topicId)} loading={practising === r.topicId} disabled={practising != null}>
                        Start practice <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )
                  ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Answer review"
          description="Every question with the correct answer and a simple explanation"
          action={
            <Tabs
              value={filter}
              onChange={setFilter}
              tabs={[
                { value: "wrong", label: "Incorrect", count: detail.answers.filter((a) => !a.isCorrect).length },
                { value: "right", label: "Correct", count: detail.answers.filter((a) => a.isCorrect).length },
                { value: "all", label: "All" },
              ]}
            />
          }
          className="flex-col sm:flex-row"
        />
        <div className="space-y-3 p-5 sm:p-6">
          {shown.length === 0 && <p className="text-sm text-slate-500">Nothing to show here.</p>}
          {shown.map((a) => {
            const i = detail.answers.indexOf(a);
            const open = openQ === a.questionId || shown.length <= 3;
            const Icon = a.selectedIndex === null ? MinusCircle : a.isCorrect ? CheckCircle2 : XCircle;
            return (
              <div key={a.questionId} className={cn("rounded-xl border", a.isCorrect ? "border-slate-200" : "border-rose-200")}>
                <button type="button" onClick={() => setOpenQ(open && openQ === a.questionId ? null : a.questionId)} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={open}>
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", a.selectedIndex === null ? "text-slate-400" : a.isCorrect ? "text-emerald-500" : "text-rose-500")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">
                      <span className="text-slate-400">Q{i + 1}.</span> {a.prompt}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge>{a.topicName}</Badge>
                      <Badge tone="brand">{a.concept}</Badge>
                    </div>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="border-t border-slate-100 px-4 pt-3 pb-4 sm:pl-12">
                    <div className="grid gap-2">
                      {a.options.map((o, oi) => {
                        const correct = oi === a.correctIndex;
                        const picked = oi === a.selectedIndex;
                        return (
                          <div key={oi} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm", correct ? "bg-emerald-50 text-emerald-900" : picked ? "bg-rose-50 text-rose-900" : "text-slate-600")}>
                            <span className="w-5 font-bold">{LETTERS[oi]}</span>
                            <span className="flex-1">{o}</span>
                            {correct && <span className="text-xs font-semibold text-emerald-700">Correct answer</span>}
                            {picked && !correct && <span className="text-xs font-semibold text-rose-700">{you ? "Your answer" : "Student's answer"}</span>}
                          </div>
                        );
                      })}
                      {a.selectedIndex === null && <div className="text-xs text-slate-500">Left blank.</div>}
                    </div>
                    <div className={cn("mt-3 rounded-lg p-3 text-sm", STATUS_META.strong.bg)}>
                      <span className="font-semibold text-ink">Why: </span>
                      <span className="text-slate-700">{a.explanation}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
