import { and, eq, inArray, desc, isNotNull, gte, asc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { average, computeStreak, dayKey, topicMastery } from "./engine.js";
import { loadAnswers } from "./learning.js";
import type { GapForReport } from "./fallback.js";

const { users, studentProfiles, classes, subjects, topics, knowledgeGaps, assessmentResults, assessments, studentAnswers, lessonProgress, lessons, recommendations, progressRecords } = schema;

export async function catalog() {
  const subs = await db().select().from(subjects).orderBy(asc(subjects.id));
  const tops = await db().select().from(topics).orderBy(asc(topics.subjectId), asc(topics.sortOrder), asc(topics.id));
  return subs.map((s) => ({ ...s, topics: tops.filter((t) => t.subjectId === s.id) }));
}

export async function gapsWithNames(studentId: number) {
  return db()
    .select({
      topicId: knowledgeGaps.topicId,
      topicName: topics.name,
      subjectId: topics.subjectId,
      subjectName: subjects.name,
      mastery: knowledgeGaps.mastery,
      previousMastery: knowledgeGaps.previousMastery,
      status: knowledgeGaps.status,
      attempts: knowledgeGaps.attempts,
      weakConcepts: knowledgeGaps.weakConcepts,
      updatedAt: knowledgeGaps.updatedAt,
    })
    .from(knowledgeGaps)
    .innerJoin(topics, eq(topics.id, knowledgeGaps.topicId))
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(eq(knowledgeGaps.studentId, studentId))
    .orderBy(asc(knowledgeGaps.mastery));
}

export async function studentProfile(studentId: number) {
  const [p] = await db()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      grade: studentProfiles.grade,
      classId: studentProfiles.classId,
      className: classes.name,
      preferredLanguage: studentProfiles.preferredLanguage,
      dailyQuestionGoal: studentProfiles.dailyQuestionGoal,
      avatarColor: studentProfiles.avatarColor,
    })
    .from(users)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(classes, eq(classes.id, studentProfiles.classId))
    .where(eq(users.id, studentId));
  return p ?? null;
}

async function activeDays(studentId: number, since: Date) {
  const a = await db()
    .select({ at: assessmentResults.completedAt })
    .from(assessmentResults)
    .where(and(eq(assessmentResults.studentId, studentId), isNotNull(assessmentResults.completedAt), gte(assessmentResults.completedAt, since)));
  const l = await db()
    .select({ at: lessonProgress.completedAt })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.studentId, studentId), gte(lessonProgress.completedAt, since)));
  const counts = new Map<string, number>();
  for (const r of [...a, ...l]) if (r.at) counts.set(dayKey(r.at), (counts.get(dayKey(r.at)) ?? 0) + 1);
  return counts;
}

export async function studentDashboard(studentId: number, now = new Date()) {
  const profile = await studentProfile(studentId);
  const cat = await catalog();
  const gaps = await gapsWithNames(studentId);
  const today = dayKey(now);
  const since60 = new Date(now.getTime() - 60 * 864e5);
  const days = await activeDays(studentId, since60);

  const completed = await db()
    .select({ id: assessmentResults.id, percent: assessmentResults.percent, score: assessmentResults.score, total: assessmentResults.total, completedAt: assessmentResults.completedAt, title: assessments.title, kind: assessments.kind, subjectName: subjects.name })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
    .where(and(eq(assessmentResults.studentId, studentId), isNotNull(assessmentResults.completedAt)))
    .orderBy(desc(assessmentResults.completedAt));

  // Count today's answers in the school's timezone (a 36h window always covers "today").
  const recentAnswers = await db()
    .select({ at: studentAnswers.answeredAt })
    .from(studentAnswers)
    .where(and(eq(studentAnswers.studentId, studentId), gte(studentAnswers.answeredAt, new Date(now.getTime() - 36 * 3600 * 1000))));
  const answeredToday = recentAnswers.filter((a) => dayKey(a.at) === today).length;
  const lessonsDone = await db().select({ lessonId: lessonProgress.lessonId, completedAt: lessonProgress.completedAt }).from(lessonProgress).where(eq(lessonProgress.studentId, studentId));
  const lessonsToday = lessonsDone.filter((l) => dayKey(l.completedAt) === today).length;
  const assessmentsToday = completed.filter((c) => c.completedAt && dayKey(c.completedAt) === today).length;

  // Mastery 7 days ago per subject (latest snapshot on or before that day) for trend arrows.
  const weekAgo = dayKey(new Date(now.getTime() - 7 * 864e5));
  const snaps = await db().select().from(progressRecords).where(eq(progressRecords.studentId, studentId)).orderBy(asc(progressRecords.recordedOn));

  const subjectsOut = cat.map((s) => {
    const sg = gaps.filter((g) => g.subjectId === s.id);
    const mastery = average(sg.map((g) => g.mastery));
    const past = snaps.filter((p) => p.subjectId === s.id && p.recordedOn <= weekAgo).at(-1)?.mastery ?? null;
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      color: s.color,
      icon: s.icon,
      mastery,
      change: mastery !== null && past !== null ? Math.round((mastery - past) * 10) / 10 : null,
      topicsAssessed: sg.length,
      totalTopics: s.topics.length,
    };
  });

  const assigned = profile?.classId
    ? await db()
        .select({ id: assessments.id, title: assessments.title, dueAt: assessments.dueAt, questionCount: assessments.questionCount, subjectName: subjects.name })
        .from(assessments)
        .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
        .where(and(eq(assessments.kind, "assigned"), eq(assessments.classId, profile.classId)))
        .orderBy(asc(assessments.dueAt))
    : [];
  const doneAssigned = new Set(
    (
      await db()
        .select({ assessmentId: assessmentResults.assessmentId })
        .from(assessmentResults)
        .where(and(eq(assessmentResults.studentId, studentId), isNotNull(assessmentResults.completedAt)))
    ).map((r) => r.assessmentId),
  );

  const recs = await db()
    .select({ id: recommendations.id, type: recommendations.type, title: recommendations.title, reason: recommendations.reason, lessonId: recommendations.lessonId, topicId: recommendations.topicId, priority: recommendations.priority })
    .from(recommendations)
    .where(and(eq(recommendations.studentId, studentId), eq(recommendations.status, "pending")))
    .orderBy(asc(recommendations.priority))
    .limit(3);

  const goal = profile?.dailyQuestionGoal ?? 10;
  return {
    profile,
    stats: {
      overallMastery: average(gaps.map((g) => g.mastery)),
      assessmentsCompleted: completed.length,
      lessonsCompleted: lessonsDone.length,
      streak: computeStreak(new Set(days.keys()), today),
      topicsAssessed: gaps.length,
      totalTopics: cat.reduce((n, s) => n + s.topics.length, 0),
    },
    subjects: subjectsOut,
    topics: {
      strong: gaps.filter((g) => g.status === "strong").sort((a, b) => b.mastery - a.mastery),
      needsImprovement: gaps.filter((g) => g.status === "needs_improvement"),
      weak: gaps.filter((g) => g.status === "weak"),
    },
    dailyGoals: [
      { key: "questions", label: `Answer ${goal} questions`, current: Math.min(answeredToday, goal), target: goal },
      { key: "lesson", label: "Complete a lesson", current: Math.min(lessonsToday, 1), target: 1 },
      { key: "assessment", label: "Finish an assessment", current: Math.min(assessmentsToday, 1), target: 1 },
    ],
    recentResults: completed.slice(0, 5),
    assigned: assigned.map((a) => ({ ...a, completed: doneAssigned.has(a.id) })),
    recommendations: recs,
  };
}

export async function studentProgress(studentId: number, now = new Date()) {
  const cat = await catalog();
  const snaps = await db().select().from(progressRecords).where(eq(progressRecords.studentId, studentId)).orderBy(asc(progressRecords.recordedOn));
  const history = await db()
    .select({ id: assessmentResults.id, percent: assessmentResults.percent, score: assessmentResults.score, total: assessmentResults.total, completedAt: assessmentResults.completedAt, title: assessments.title, kind: assessments.kind, subjectId: assessments.subjectId, subjectName: subjects.name })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
    .where(and(eq(assessmentResults.studentId, studentId), isNotNull(assessmentResults.completedAt)))
    .orderBy(desc(assessmentResults.completedAt));

  // Timeline: one row per day with each subject's mastery carried forward.
  const dates = [...new Set(snaps.map((s) => s.recordedOn))].sort();
  const last = new Map<number, number>();
  const timeline = dates.map((d) => {
    for (const s of snaps.filter((x) => x.recordedOn === d)) last.set(s.subjectId, s.mastery);
    const row: Record<string, number | string> = { date: d };
    for (const s of cat) if (last.has(s.id)) row[s.slug] = last.get(s.id)!;
    return row;
  });

  // Then vs now: mastery after the first attempt on each topic vs mastery today,
  // both computed with the same formula so the two numbers are comparable.
  const gaps = await gapsWithNames(studentId);
  const allAnswers = await loadAnswers(studentId);
  const firstAttempt = new Map<number, number>(); // topicId -> resultId of the earliest attempt
  for (const a of [...allAnswers].sort((x, y) => x.answeredAt.getTime() - y.answeredAt.getTime() || (x.answerId ?? 0) - (y.answerId ?? 0)))
    if (!firstAttempt.has(a.topicId) && a.resultId !== undefined) firstAttempt.set(a.topicId, a.resultId);
  const comparison = gaps
    .map((g) => {
      const first = topicMastery(
        g.topicId,
        allAnswers.filter((a) => a.topicId === g.topicId && a.resultId === firstAttempt.get(g.topicId)),
      );
      return {
        topicId: g.topicId,
        topicName: g.topicName,
        subjectName: g.subjectName,
        then: first ? Math.round(first.mastery) : null,
        now: Math.round(g.mastery),
        status: g.status,
      };
    })
    .sort((a, b) => b.now - (b.then ?? b.now) - (a.now - (a.then ?? a.now)));

  const days = await activeDays(studentId, new Date(now.getTime() - 34 * 864e5));
  const calendar = Array.from({ length: 35 }, (_, i) => {
    const d = dayKey(new Date(now.getTime() - (34 - i) * 864e5));
    return { date: d, count: days.get(d) ?? 0 };
  });

  const lessonsDone = await db()
    .select({ id: lessons.id, title: lessons.title, completedAt: lessonProgress.completedAt, topicName: topics.name })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .innerJoin(topics, eq(topics.id, lessons.topicId))
    .where(eq(lessonProgress.studentId, studentId))
    .orderBy(desc(lessonProgress.completedAt));

  const allDays = await activeDays(studentId, new Date(now.getTime() - 365 * 864e5));
  return {
    subjects: cat.map((s) => ({ id: s.id, slug: s.slug, name: s.name, color: s.color })),
    timeline,
    history,
    comparison,
    calendar,
    streak: computeStreak(new Set(allDays.keys()), dayKey(now)),
    lessonsCompleted: lessonsDone,
  };
}

/** Compact, factual text about a student's results, fed to the AI as context. */
export function describeGaps(gaps: GapForReport[], history: { title: string; percent: number | null }[] = []) {
  if (!gaps.length) return "No assessments completed yet.";
  const lines = gaps.map(
    (g) =>
      `- ${g.subjectName} / ${g.topicName}: ${Math.round(g.mastery)}% mastery (${g.status.replace("_", " ")})` +
      (g.previousMastery !== null ? `, previously ${Math.round(g.previousMastery)}%` : "") +
      (g.weakConcepts.length ? `; weak concepts: ${g.weakConcepts.map((c) => `${c.concept} (missed ${c.missed}/${c.attempted})`).join(", ")}` : ""),
  );
  if (history.length) lines.push(`Recent assessments: ${history.slice(0, 6).map((h) => `${h.title} ${Math.round(h.percent ?? 0)}%`).join("; ")}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- teacher

export async function teacherClassIds(teacherId: number) {
  return (await db().select({ id: classes.id }).from(classes).where(eq(classes.teacherId, teacherId))).map((c) => c.id);
}

/** Students in the teacher's classes with summary metrics. Admins see everyone. */
export async function rosterFor(classIds: number[] | "all", now = new Date()) {
  if (classIds !== "all" && classIds.length === 0) return [];
  const where = classIds === "all" ? eq(users.role, "student") : and(eq(users.role, "student"), inArray(studentProfiles.classId, classIds));
  const students = await db()
    .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive, grade: studentProfiles.grade, classId: studentProfiles.classId, className: classes.name, avatarColor: studentProfiles.avatarColor })
    .from(users)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(classes, eq(classes.id, studentProfiles.classId))
    .where(where)
    .orderBy(asc(users.name));
  const ids = students.map((s) => s.id);
  if (!ids.length) return [];

  const gaps = await db()
    .select({ studentId: knowledgeGaps.studentId, topicId: knowledgeGaps.topicId, topicName: topics.name, mastery: knowledgeGaps.mastery, previousMastery: knowledgeGaps.previousMastery, status: knowledgeGaps.status, weakConcepts: knowledgeGaps.weakConcepts })
    .from(knowledgeGaps)
    .innerJoin(topics, eq(topics.id, knowledgeGaps.topicId))
    .where(inArray(knowledgeGaps.studentId, ids));
  const results = await db()
    .select({ studentId: assessmentResults.studentId, percent: assessmentResults.percent, completedAt: assessmentResults.completedAt, kind: assessments.kind })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .where(and(inArray(assessmentResults.studentId, ids), isNotNull(assessmentResults.completedAt)))
    .orderBy(asc(assessmentResults.completedAt));

  return students.map((s) => {
    const g = gaps.filter((x) => x.studentId === s.id);
    const r = results.filter((x) => x.studentId === s.id);
    const mastery = average(g.map((x) => x.mastery));
    const weakest = [...g].sort((a, b) => a.mastery - b.mastery)[0] ?? null;
    // Practice sets deliberately target weak concepts, so their scores would drag
    // the trend down; measure it on diagnostics and teacher assessments only.
    const measured = r.filter((x) => x.kind !== "practice");
    const recent = measured.slice(-3).map((x) => x.percent ?? 0);
    const earlier = measured.slice(-6, -3).map((x) => x.percent ?? 0);
    const trend = recent.length && earlier.length ? Math.round(((average(recent) ?? 0) - (average(earlier) ?? 0)) * 10) / 10 : null;
    const weakCount = g.filter((x) => x.status === "weak").length;
    const reasons: string[] = [];
    if (mastery !== null && mastery < 50) reasons.push("Overall mastery below 50%");
    if (weakCount >= 3) reasons.push(`${weakCount} weak topics`);
    if (trend !== null && trend <= -15) reasons.push(`Scores down ${Math.abs(Math.round(trend))} pts`);
    const lastActive = r.at(-1)?.completedAt ?? null;
    if (lastActive && now.getTime() - lastActive.getTime() > 10 * 864e5) reasons.push("Inactive for 10+ days");
    if (!r.length) reasons.push("No assessments yet");
    return {
      ...s,
      mastery,
      assessments: r.length,
      lastActive,
      trend,
      weakCount,
      weakestTopic: weakest ? { name: weakest.topicName, mastery: weakest.mastery, concept: weakest.weakConcepts[0]?.concept ?? null } : null,
      needsAttention: reasons.length > 0,
      attentionReasons: reasons,
    };
  });
}

export async function classroomOverview(classIds: number[] | "all", now = new Date()) {
  const roster = await rosterFor(classIds, now);
  const ids = roster.map((s) => s.id);
  const cat = await catalog();
  const gaps = ids.length
    ? await db()
        .select({ studentId: knowledgeGaps.studentId, topicId: knowledgeGaps.topicId, mastery: knowledgeGaps.mastery, status: knowledgeGaps.status, weakConcepts: knowledgeGaps.weakConcepts })
        .from(knowledgeGaps)
        .where(inArray(knowledgeGaps.studentId, ids))
    : [];
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  const recentResults = ids.length
    ? await db()
        .select({ percent: assessmentResults.percent, completedAt: assessmentResults.completedAt })
        .from(assessmentResults)
        .where(and(inArray(assessmentResults.studentId, ids), isNotNull(assessmentResults.completedAt), gte(assessmentResults.completedAt, new Date(now.getTime() - 28 * 864e5))))
    : [];

  const topicHeat = cat.flatMap((s) =>
    s.topics.map((t) => {
      const tg = gaps.filter((g) => g.topicId === t.id);
      return {
        topicId: t.id,
        topicName: t.name,
        subjectName: s.name,
        subjectSlug: s.slug,
        average: average(tg.map((g) => g.mastery)),
        weak: tg.filter((g) => g.status === "weak").length,
        needsImprovement: tg.filter((g) => g.status === "needs_improvement").length,
        strong: tg.filter((g) => g.status === "strong").length,
        assessed: tg.length,
      };
    }),
  );
  const conceptCounts = new Map<string, { concept: string; topicName: string; students: number }>();
  const topicName = new Map(topicHeat.map((t) => [t.topicId, t.topicName]));
  for (const g of gaps)
    for (const c of g.weakConcepts) {
      const key = `${g.topicId}::${c.concept}`;
      const e = conceptCounts.get(key) ?? { concept: c.concept, topicName: topicName.get(g.topicId) ?? "", students: 0 };
      e.students += 1;
      conceptCounts.set(key, e);
    }

  // Weekly class average for the last 4 weeks.
  const weekly = [3, 2, 1, 0].map((w) => {
    const start = new Date(now.getTime() - (w + 1) * 7 * 864e5);
    const end = new Date(now.getTime() - w * 7 * 864e5);
    const rs = recentResults.filter((r) => r.completedAt! >= start && r.completedAt! < end);
    return { week: w === 0 ? "This week" : `${w}w ago`, average: average(rs.map((r) => r.percent ?? 0)), assessments: rs.length };
  });

  return {
    stats: {
      students: roster.length,
      classAverage: average(roster.flatMap((s) => (s.mastery === null ? [] : [s.mastery]))),
      needsAttention: roster.filter((s) => s.needsAttention).length,
      assessmentsThisWeek: recentResults.filter((r) => r.completedAt! >= weekAgo).length,
    },
    subjects: cat.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      color: s.color,
      average: average(gaps.filter((g) => s.topics.some((t) => t.id === g.topicId)).map((g) => g.mastery)),
    })),
    topicHeat,
    commonWeakConcepts: [...conceptCounts.values()].sort((a, b) => b.students - a.students).slice(0, 8),
    weekly,
    attention: roster.filter((s) => s.needsAttention).sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0)),
    roster,
  };
}
