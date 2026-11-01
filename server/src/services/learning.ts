import { and, eq, inArray, desc, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import {
  topicMastery,
  buildRecommendations,
  average,
  dayKey,
  type AnswerRecord,
  type TopicMastery,
} from "./engine.js";

const { studentAnswers, questions, topics, knowledgeGaps, recommendations, lessons, lessonProgress, progressRecords } = schema;

/** All of a student's answers on the given topics (or all topics), joined with question metadata. */
export async function loadAnswers(studentId: number, topicIds?: number[]): Promise<AnswerRecord[]> {
  const where = topicIds?.length
    ? and(eq(studentAnswers.studentId, studentId), inArray(studentAnswers.topicId, topicIds))
    : eq(studentAnswers.studentId, studentId);
  const rows = await db()
    .select({
      answerId: studentAnswers.id,
      resultId: studentAnswers.resultId,
      questionId: studentAnswers.questionId,
      topicId: studentAnswers.topicId,
      isCorrect: studentAnswers.isCorrect,
      answeredAt: studentAnswers.answeredAt,
      concept: questions.concept,
      difficulty: questions.difficulty,
    })
    .from(studentAnswers)
    .innerJoin(questions, eq(questions.id, studentAnswers.questionId))
    .where(where);
  return rows;
}

/**
 * Recomputes knowledge gaps for the given topics from the student's real answers,
 * snapshots subject mastery for the progress chart, and refreshes recommendations.
 * Called after every submitted assessment.
 */
export async function refreshLearningState(studentId: number, topicIds: number[], now = new Date()) {
  const answers = await loadAnswers(studentId, topicIds);
  const existing = await db()
    .select()
    .from(knowledgeGaps)
    .where(and(eq(knowledgeGaps.studentId, studentId), inArray(knowledgeGaps.topicId, topicIds)));
  const prevByTopic = new Map(existing.map((g) => [g.topicId, g.mastery]));

  const computed: TopicMastery[] = [];
  for (const t of topicIds) {
    const m = topicMastery(t, answers);
    if (m) computed.push(m);
  }
  for (const m of computed) {
    const previous = prevByTopic.get(m.topicId) ?? null;
    await db()
      .insert(knowledgeGaps)
      .values({
        studentId,
        topicId: m.topicId,
        mastery: m.mastery,
        status: m.status,
        attempts: m.attempts,
        weakConcepts: m.weakConcepts,
        previousMastery: previous,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [knowledgeGaps.studentId, knowledgeGaps.topicId],
        set: {
          mastery: m.mastery,
          status: m.status,
          attempts: m.attempts,
          weakConcepts: m.weakConcepts,
          previousMastery: previous,
          updatedAt: now,
        },
      });
  }

  const subjectIds = await db()
    .selectDistinct({ subjectId: topics.subjectId })
    .from(topics)
    .where(inArray(topics.id, topicIds));
  for (const { subjectId } of subjectIds) await snapshotSubject(studentId, subjectId, now);

  await regenerateRecommendations(studentId, subjectIds.map((s) => s.subjectId));
}

async function snapshotSubject(studentId: number, subjectId: number, now: Date) {
  const rows = await db()
    .select({ mastery: knowledgeGaps.mastery })
    .from(knowledgeGaps)
    .innerJoin(topics, eq(topics.id, knowledgeGaps.topicId))
    .where(and(eq(knowledgeGaps.studentId, studentId), eq(topics.subjectId, subjectId)));
  const avg = average(rows.map((r) => r.mastery));
  if (avg === null) return;
  const recordedOn = dayKey(now);
  await db()
    .insert(progressRecords)
    .values({ studentId, subjectId, mastery: avg, recordedOn })
    .onConflictDoUpdate({
      target: [progressRecords.studentId, progressRecords.subjectId, progressRecords.recordedOn],
      set: { mastery: avg },
    });
}

/**
 * Replaces the student's *pending* recommendations for the given subjects with a
 * fresh set derived from current gaps. Completed/dismissed ones are kept as history.
 */
export async function regenerateRecommendations(studentId: number, subjectIds: number[]) {
  if (subjectIds.length === 0) return;
  const gapRows = await db()
    .select({
      topicId: knowledgeGaps.topicId,
      mastery: knowledgeGaps.mastery,
      status: knowledgeGaps.status,
      attempts: knowledgeGaps.attempts,
      weakConcepts: knowledgeGaps.weakConcepts,
      previousMastery: knowledgeGaps.previousMastery,
      topicName: topics.name,
    })
    .from(knowledgeGaps)
    .innerJoin(topics, eq(topics.id, knowledgeGaps.topicId))
    .where(and(eq(knowledgeGaps.studentId, studentId), inArray(topics.subjectId, subjectIds)));
  const topicIds = gapRows.map((g) => g.topicId);

  const lessonRows = topicIds.length
    ? await db().select({ id: lessons.id, title: lessons.title, topicId: lessons.topicId }).from(lessons).where(inArray(lessons.topicId, topicIds)).orderBy(lessons.id)
    : [];
  const lessonByTopic = new Map<number, { id: number; title: string }>();
  for (const l of lessonRows) if (!lessonByTopic.has(l.topicId)) lessonByTopic.set(l.topicId, l);

  // Was the topic's lesson completed after the student's latest answer on it?
  const lastAnswer = topicIds.length
    ? await db()
        .select({ topicId: studentAnswers.topicId, last: sql<string>`max(${studentAnswers.answeredAt})` })
        .from(studentAnswers)
        .where(and(eq(studentAnswers.studentId, studentId), inArray(studentAnswers.topicId, topicIds)))
        .groupBy(studentAnswers.topicId)
    : [];
  const lastByTopic = new Map(lastAnswer.map((r) => [r.topicId, new Date(r.last)]));
  const done = lessonRows.length
    ? await db()
        .select({ lessonId: lessonProgress.lessonId, completedAt: lessonProgress.completedAt })
        .from(lessonProgress)
        .where(and(eq(lessonProgress.studentId, studentId), inArray(lessonProgress.lessonId, lessonRows.map((l) => l.id))))
    : [];
  const lessonTopic = new Map(lessonRows.map((l) => [l.id, l.topicId]));
  const lessonDoneSinceLastAttempt = new Set<number>();
  for (const d of done) {
    const t = lessonTopic.get(d.lessonId)!;
    const last = lastByTopic.get(t);
    if (!last || d.completedAt > last) lessonDoneSinceLastAttempt.add(t);
  }

  const drafts = buildRecommendations({ gaps: gapRows, lessonByTopic, lessonDoneSinceLastAttempt });

  const subjectTopicIds = (
    await db().select({ id: topics.id }).from(topics).where(inArray(topics.subjectId, subjectIds))
  ).map((t) => t.id);
  await db()
    .delete(recommendations)
    .where(
      and(
        eq(recommendations.studentId, studentId),
        eq(recommendations.status, "pending"),
        inArray(recommendations.topicId, subjectTopicIds),
      ),
    );
  if (drafts.length) {
    await db().insert(recommendations).values(drafts.map((d) => ({ ...d, studentId, source: "rules" as const })));
  }
}

/** Marks a lesson complete, resolves its lesson recommendation and refreshes recs. */
export async function completeLesson(studentId: number, lessonId: number, now = new Date()) {
  const [lesson] = await db()
    .select({ id: lessons.id, topicId: lessons.topicId, subjectId: topics.subjectId })
    .from(lessons)
    .innerJoin(topics, eq(topics.id, lessons.topicId))
    .where(eq(lessons.id, lessonId));
  if (!lesson) return null;
  await db()
    .insert(lessonProgress)
    .values({ studentId, lessonId, completedAt: now })
    .onConflictDoUpdate({ target: [lessonProgress.studentId, lessonProgress.lessonId], set: { completedAt: now } });
  await db()
    .update(recommendations)
    .set({ status: "completed", completedAt: now })
    .where(
      and(
        eq(recommendations.studentId, studentId),
        eq(recommendations.lessonId, lessonId),
        eq(recommendations.status, "pending"),
      ),
    );
  // Mark it completed first so the history keeps it, then regenerate the remaining
  // pending set (the practice rec now says "you've studied the lesson…").
  await regenerateRecommendations(studentId, [lesson.subjectId]);
  return lesson;
}

/** Most recent question ids a student has seen (to avoid repeats on retry). */
export async function recentlySeenQuestionIds(studentId: number, limit = 40): Promise<Set<number>> {
  const rows = await db()
    .select({ questionId: studentAnswers.questionId })
    .from(studentAnswers)
    .where(eq(studentAnswers.studentId, studentId))
    .orderBy(desc(studentAnswers.answeredAt))
    .limit(limit);
  return new Set(rows.map((r) => r.questionId));
}

export async function gapMaps(studentId: number) {
  const rows = await db().select().from(knowledgeGaps).where(eq(knowledgeGaps.studentId, studentId));
  return {
    mastery: new Map(rows.map((r) => [r.topicId, r.mastery])),
    weakConcepts: new Map(rows.map((r) => [r.topicId, new Set(r.weakConcepts.map((c) => c.concept))])),
    rows,
  };
}

