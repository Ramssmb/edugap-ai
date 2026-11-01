import { and, eq, inArray, isNull, asc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { HttpError, notFound, forbidden } from "../middleware/errors.js";
import { grade, selectQuestions, type Difficulty } from "./engine.js";
import { gapMaps, recentlySeenQuestionIds, refreshLearningState } from "./learning.js";
import { logActivity } from "./activity.js";
import { aiEnabled } from "../config.js";
import { aiPracticeQuestions, AiUnavailable } from "./ai.js";
import type { TopicBreakdown } from "../db/schema.js";

const { assessments, assessmentQuestions, assessmentResults, questions, topics, subjects, studentAnswers, knowledgeGaps, studentProfiles, recommendations } = schema;

export const DIAGNOSTIC_SIZE = 10;
export const PRACTICE_SIZE = 5;

export type StartRequest =
  | { mode: "diagnostic"; subjectId: number }
  | { mode: "practice"; topicId: number }
  | { mode: "assigned"; assessmentId: number };

async function findOrCreateSystemAssessment(kind: "diagnostic" | "practice", subjectId: number, topicIds: number[], title: string, count: number) {
  const existing = await db()
    .select()
    .from(assessments)
    .where(and(eq(assessments.kind, kind), eq(assessments.subjectId, subjectId), isNull(assessments.createdBy), isNull(assessments.classId)));
  const match = existing.find((a) => JSON.stringify([...a.topicIds].sort()) === JSON.stringify([...topicIds].sort()));
  if (match) return match;
  const [created] = await db().insert(assessments).values({ title, kind, subjectId, topicIds, questionCount: count }).returning();
  return created;
}

async function poolFor(topicIds: number[]) {
  return db()
    .select({ id: questions.id, topicId: questions.topicId, concept: questions.concept, difficulty: questions.difficulty })
    .from(questions)
    // Only curated questions go into adaptive selection; AI-generated ones are
    // served once, in the practice set they were generated for.
    .where(and(inArray(questions.topicId, topicIds), eq(questions.source, "rules")));
}

/** Creates an attempt and returns the questions to show (never the answers). */
export async function startAttempt(studentId: number, req: StartRequest, preselected?: number[], now = new Date()) {
  let assessment;
  let questionIds: number[];

  if (req.mode === "assigned") {
    const [a] = await db().select().from(assessments).where(eq(assessments.id, req.assessmentId));
    if (!a || a.kind !== "assigned") throw notFound("Assessment");
    const [profile] = await db().select({ classId: studentProfiles.classId }).from(studentProfiles).where(eq(studentProfiles.userId, studentId));
    if (!profile || profile.classId !== a.classId) throw forbidden();
    assessment = a;
    questionIds = (
      await db().select({ id: assessmentQuestions.questionId }).from(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, a.id)).orderBy(asc(assessmentQuestions.position))
    ).map((r) => r.id);
  } else {
    const isPractice = req.mode === "practice";
    let subjectId: number;
    let topicIds: number[];
    let title: string;
    if (isPractice) {
      const [t] = await db().select({ id: topics.id, name: topics.name, subjectId: topics.subjectId }).from(topics).where(eq(topics.id, req.topicId));
      if (!t) throw notFound("Topic");
      subjectId = t.subjectId;
      topicIds = [t.id];
      title = `Practice: ${t.name}`;
    } else {
      const [s] = await db().select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.id, req.subjectId));
      if (!s) throw notFound("Subject");
      subjectId = s.id;
      topicIds = (await db().select({ id: topics.id }).from(topics).where(eq(topics.subjectId, s.id))).map((t) => t.id);
      if (topicIds.length === 0) throw new HttpError(422, "This subject has no topics yet");
      title = `${s.name} Diagnostic`;
    }
    const size = isPractice ? PRACTICE_SIZE : DIAGNOSTIC_SIZE;
    assessment = await findOrCreateSystemAssessment(isPractice ? "practice" : "diagnostic", subjectId, topicIds, title, size);
    if (preselected?.length) questionIds = preselected;
    else {
      const [pool, gaps, seen] = await Promise.all([poolFor(topicIds), gapMaps(studentId), recentlySeenQuestionIds(studentId)]);
      questionIds = selectQuestions({ pool, topicIds, count: size, mastery: gaps.mastery, weakConcepts: gaps.weakConcepts, recentlySeen: seen });
    }
  }
  if (questionIds.length === 0) throw new HttpError(422, "No questions are available for this assessment yet");

  const [result] = await db()
    .insert(assessmentResults)
    .values({ assessmentId: assessment.id, studentId, questionIds, total: questionIds.length, startedAt: now })
    .returning({ id: assessmentResults.id });

  return { resultId: result.id, ...(await attemptPayload(assessment.id, questionIds)) };
}

async function attemptPayload(assessmentId: number, questionIds: number[]) {
  const [a] = await db()
    .select({ id: assessments.id, title: assessments.title, kind: assessments.kind, subjectName: subjects.name, subjectSlug: subjects.slug })
    .from(assessments)
    .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
    .where(eq(assessments.id, assessmentId));
  const rows = await db()
    .select({ id: questions.id, prompt: questions.prompt, options: questions.options, difficulty: questions.difficulty, topicName: topics.name, source: questions.source })
    .from(questions)
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(inArray(questions.id, questionIds));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return { assessment: a, questions: questionIds.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q)) };
}

/** Resume an unfinished attempt (e.g. after a page refresh). */
export async function getOpenAttempt(studentId: number, resultId: number) {
  const [r] = await db().select().from(assessmentResults).where(eq(assessmentResults.id, resultId));
  if (!r || r.studentId !== studentId) throw notFound("Attempt");
  if (r.completedAt) throw new HttpError(409, "This attempt has already been submitted");
  return { resultId: r.id, ...(await attemptPayload(r.assessmentId, r.questionIds)) };
}

export async function submitAttempt(studentId: number, resultId: number, answers: { questionId: number; selectedIndex: number | null }[], now = new Date()) {
  const [r] = await db().select().from(assessmentResults).where(eq(assessmentResults.id, resultId));
  if (!r || r.studentId !== studentId) throw notFound("Attempt");
  if (r.completedAt) throw new HttpError(409, "This attempt has already been submitted");

  const served = await db()
    .select({ id: questions.id, topicId: questions.topicId, correctIndex: questions.correctIndex, options: questions.options, topicName: topics.name })
    .from(questions)
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(inArray(questions.id, r.questionIds));
  // Only questions that were actually served are graded; anything else in the body is ignored.
  const submitted = new Map<number, number | null>();
  for (const a of answers) if (r.questionIds.includes(a.questionId)) submitted.set(a.questionId, a.selectedIndex);
  const g = grade(served, submitted);

  const topicNames = new Map(served.map((q) => [q.topicId, q.topicName]));
  const breakdown: TopicBreakdown[] = [...topicNames.entries()].map(([topicId, topicName]) => {
    const qs = g.perQuestion.filter((p) => p.topicId === topicId);
    const correct = qs.filter((p) => p.isCorrect).length;
    return { topicId, topicName, correct, total: qs.length, percent: Math.round((correct / qs.length) * 1000) / 10 };
  });

  const topicIds = [...topicNames.keys()];
  const before = await db().select({ topicId: knowledgeGaps.topicId, mastery: knowledgeGaps.mastery, status: knowledgeGaps.status }).from(knowledgeGaps).where(and(eq(knowledgeGaps.studentId, studentId), inArray(knowledgeGaps.topicId, topicIds)));

  await db().transaction(async (tx) => {
    // Conditional update guards against a double submit racing past the check above.
    const updated = await tx
      .update(assessmentResults)
      .set({ score: g.score, percent: g.percent, topicBreakdown: breakdown, completedAt: now })
      .where(and(eq(assessmentResults.id, resultId), isNull(assessmentResults.completedAt)))
      .returning({ id: assessmentResults.id });
    if (updated.length === 0) throw new HttpError(409, "This attempt has already been submitted");
    await tx.insert(studentAnswers).values(
      g.perQuestion.map((p) => ({ resultId, studentId, questionId: p.questionId, topicId: p.topicId, selectedIndex: p.selectedIndex, isCorrect: p.isCorrect, answeredAt: now })),
    );
  });

  await refreshLearningState(studentId, topicIds, now);
  const [a] = await db().select({ title: assessments.title }).from(assessments).where(eq(assessments.id, r.assessmentId));
  await logActivity(studentId, "assessment", `completed "${a?.title}" with ${g.score}/${g.total} (${Math.round(g.percent)}%)`, now);

  return { ...(await resultDetail(resultId)), before };
}

/** Full review of a completed attempt: every question with the right answer and explanation. */
export async function resultDetail(resultId: number) {
  const [r] = await db()
    .select({
      id: assessmentResults.id,
      studentId: assessmentResults.studentId,
      score: assessmentResults.score,
      total: assessmentResults.total,
      percent: assessmentResults.percent,
      topicBreakdown: assessmentResults.topicBreakdown,
      completedAt: assessmentResults.completedAt,
      startedAt: assessmentResults.startedAt,
      questionIds: assessmentResults.questionIds,
      title: assessments.title,
      kind: assessments.kind,
      subjectId: assessments.subjectId,
      subjectName: subjects.name,
    })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
    .where(eq(assessmentResults.id, resultId));
  if (!r || !r.completedAt) throw notFound("Result");

  const answerRows = await db()
    .select({
      questionId: studentAnswers.questionId,
      selectedIndex: studentAnswers.selectedIndex,
      isCorrect: studentAnswers.isCorrect,
      prompt: questions.prompt,
      options: questions.options,
      correctIndex: questions.correctIndex,
      explanation: questions.explanation,
      concept: questions.concept,
      difficulty: questions.difficulty,
      topicId: questions.topicId,
      topicName: topics.name,
    })
    .from(studentAnswers)
    .innerJoin(questions, eq(questions.id, studentAnswers.questionId))
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(eq(studentAnswers.resultId, resultId));
  const order = new Map(r.questionIds.map((id, i) => [id, i]));
  answerRows.sort((a, b) => (order.get(a.questionId) ?? 0) - (order.get(b.questionId) ?? 0));

  const topicIds = [...new Set(answerRows.map((a) => a.topicId))];
  const gaps = topicIds.length
    ? await db()
        .select({ topicId: knowledgeGaps.topicId, topicName: topics.name, mastery: knowledgeGaps.mastery, previousMastery: knowledgeGaps.previousMastery, status: knowledgeGaps.status, weakConcepts: knowledgeGaps.weakConcepts })
        .from(knowledgeGaps)
        .innerJoin(topics, eq(topics.id, knowledgeGaps.topicId))
        .where(and(eq(knowledgeGaps.studentId, r.studentId), inArray(knowledgeGaps.topicId, topicIds)))
    : [];
  const recs = topicIds.length
    ? await db()
        .select()
        .from(recommendations)
        .where(and(eq(recommendations.studentId, r.studentId), eq(recommendations.status, "pending"), inArray(recommendations.topicId, topicIds)))
        .orderBy(asc(recommendations.priority))
    : [];

  // Concepts missed in *this* attempt — the precise "what you don't understand yet".
  const missedConcepts = new Map<string, { concept: string; topicName: string; missed: number; total: number }>();
  for (const a of answerRows) {
    const key = `${a.topicName}::${a.concept}`;
    const m = missedConcepts.get(key) ?? { concept: a.concept, topicName: a.topicName, missed: 0, total: 0 };
    m.total += 1;
    if (!a.isCorrect) m.missed += 1;
    missedConcepts.set(key, m);
  }

  const { questionIds: _q, ...rest } = r;
  return {
    result: rest,
    answers: answerRows,
    gaps,
    missedConcepts: [...missedConcepts.values()].filter((m) => m.missed > 0).sort((a, b) => b.missed - a.missed),
    recommendations: recs,
  };
}

/**
 * Targeted practice for one topic. With an API key, Claude writes fresh questions
 * aimed at the student's weak concepts (validated, then saved to the bank);
 * otherwise the adaptive selector picks bank questions on those concepts.
 */
export async function startPractice(studentId: number, topicId: number) {
  const [t] = await db()
    .select({ id: topics.id, name: topics.name, subjectName: subjects.name })
    .from(topics)
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(eq(topics.id, topicId));
  if (!t) throw notFound("Topic");

  let source: "ai" | "rules" = "rules";
  let preselected: number[] | undefined;
  if (aiEnabled()) {
    try {
      const [profile] = await db().select({ grade: studentProfiles.grade }).from(studentProfiles).where(eq(studentProfiles.userId, studentId));
      const [gap] = await db().select().from(knowledgeGaps).where(and(eq(knowledgeGaps.studentId, studentId), eq(knowledgeGaps.topicId, topicId)));
      const bank = await db().select().from(questions).where(and(eq(questions.topicId, topicId), eq(questions.source, "rules")));
      const allowed = [...new Set(bank.map((q) => q.concept))];
      const generated = await aiPracticeQuestions({
        subject: t.subjectName,
        topic: t.name,
        concepts: gap?.weakConcepts.map((c) => c.concept) ?? [],
        allowedConcepts: allowed,
        grade: profile?.grade ?? 8,
        count: PRACTICE_SIZE,
        examples: bank
          .slice(0, 3)
          .map((q) => `Q: ${q.prompt}\nOptions: ${q.options.join(" | ")}\nAnswer: ${q.options[q.correctIndex]}`)
          .join("\n\n"),
      });
      if (generated.length >= 3) {
        const inserted = await db()
          .insert(questions)
          .values(generated.map((q) => ({ topicId, concept: q.concept, difficulty: q.difficulty as Difficulty, prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation, source: "ai" as const, createdBy: studentId })))
          .returning({ id: questions.id });
        preselected = inserted.map((q) => q.id);
        source = "ai";
      }
    } catch (err) {
      if (!(err instanceof AiUnavailable)) throw err;
    }
  }
  const attempt = await startAttempt(studentId, { mode: "practice", topicId }, preselected);
  return { ...attempt, source };
}
