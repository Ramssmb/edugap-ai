import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { and, eq, asc, desc, isNotNull } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, notFound } from "../middleware/errors.js";
import { parseId } from "../util.js";
import { studentDashboard, studentProgress, gapsWithNames, describeGaps, studentProfile, catalog } from "../services/insights.js";
import { completeLesson } from "../services/learning.js";
import { startAttempt, submitAttempt, resultDetail, getOpenAttempt, startPractice } from "../services/assessments.js";
import { aiImprovementReport, AiUnavailable, type Report } from "../services/ai.js";
import { fallbackReport } from "../services/fallback.js";
import { logActivity } from "../services/activity.js";
import { config } from "../config.js";

export const studentRouter = Router();
studentRouter.use(requireRole("student"));

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 1000 : 10,
  keyGenerator: (req) => `u${req.user!.id}`,
  message: { error: "You're going a bit fast — please wait a minute and try again." },
});

studentRouter.get("/dashboard", async (req, res) => {
  res.json(await studentDashboard(req.user!.id));
});

studentRouter.get("/progress", async (req, res) => {
  res.json(await studentProgress(req.user!.id));
});

studentRouter.get("/gaps", async (req, res) => {
  res.json(await gapsWithNames(req.user!.id));
});

// Reports are cached per student until their gap data changes, so reopening the
// page doesn't re-bill the AI call.
const reportCache = new Map<number, { key: string; report: Report; source: "ai" | "rules" }>();

studentRouter.get("/report", aiLimiter, async (req, res) => {
  const id = req.user!.id;
  const gaps = await gapsWithNames(id);
  const key = gaps.map((g) => `${g.topicId}:${g.mastery}`).join("|");
  const cached = reportCache.get(id);
  if (cached && cached.key === key) return res.json({ report: cached.report, source: cached.source, gaps });

  const profile = await studentProfile(id);
  const history = await db()
    .select({ title: schema.assessments.title, percent: schema.assessmentResults.percent })
    .from(schema.assessmentResults)
    .innerJoin(schema.assessments, eq(schema.assessments.id, schema.assessmentResults.assessmentId))
    .where(and(eq(schema.assessmentResults.studentId, id), isNotNull(schema.assessmentResults.completedAt)))
    .orderBy(desc(schema.assessmentResults.completedAt))
    .limit(6);

  let report: Report;
  let source: "ai" | "rules" = "rules";
  try {
    if (gaps.length === 0) throw new AiUnavailable("No data yet");
    report = await aiImprovementReport({ name: req.user!.name, grade: profile?.grade ?? 8, data: describeGaps(gaps, history) });
    source = "ai";
  } catch (err) {
    if (!(err instanceof AiUnavailable)) throw err;
    report = fallbackReport(req.user!.name, gaps);
  }
  reportCache.set(id, { key, report, source });
  res.json({ report, source, gaps });
});

studentRouter.get("/recommendations", async (req, res) => {
  const { recommendations, topics, subjects, lessons } = schema;
  const rows = await db()
    .select({
      id: recommendations.id,
      type: recommendations.type,
      title: recommendations.title,
      reason: recommendations.reason,
      concepts: recommendations.concepts,
      priority: recommendations.priority,
      status: recommendations.status,
      source: recommendations.source,
      createdAt: recommendations.createdAt,
      completedAt: recommendations.completedAt,
      topicId: recommendations.topicId,
      topicName: topics.name,
      subjectName: subjects.name,
      subjectSlug: subjects.slug,
      lessonId: recommendations.lessonId,
      lessonMinutes: lessons.durationMinutes,
    })
    .from(recommendations)
    .innerJoin(topics, eq(topics.id, recommendations.topicId))
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .leftJoin(lessons, eq(lessons.id, recommendations.lessonId))
    .where(eq(recommendations.studentId, req.user!.id))
    .orderBy(asc(recommendations.priority), desc(recommendations.createdAt));
  res.json({
    pending: rows.filter((r) => r.status === "pending"),
    completed: rows.filter((r) => r.status === "completed").sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)).slice(0, 20),
  });
});

studentRouter.post("/recommendations/:id/dismiss", async (req, res) => {
  const id = parseId(req.params.id);
  const updated = await db()
    .update(schema.recommendations)
    .set({ status: "dismissed" })
    .where(and(eq(schema.recommendations.id, id), eq(schema.recommendations.studentId, req.user!.id), eq(schema.recommendations.status, "pending")))
    .returning({ id: schema.recommendations.id });
  if (!updated.length) throw notFound("Recommendation");
  res.json({ ok: true });
});

studentRouter.post("/lessons/:id/complete", async (req, res) => {
  const id = parseId(req.params.id, "lesson id");
  const lesson = await completeLesson(req.user!.id, id);
  if (!lesson) throw notFound("Lesson");
  const [l] = await db().select({ title: schema.lessons.title }).from(schema.lessons).where(eq(schema.lessons.id, id));
  await logActivity(req.user!.id, "lesson", `completed the lesson "${l.title}"`);
  res.json({ ok: true });
});

/** What the student can take: subject diagnostics, topic practice, and class assignments. */
studentRouter.get("/assessments", async (req, res) => {
  const id = req.user!.id;
  const profile = await studentProfile(id);
  const cat = await catalog();
  const gaps = await gapsWithNames(id);
  const { assessments, subjects, assessmentResults } = schema;
  const assigned = profile?.classId
    ? await db()
        .select({ id: assessments.id, title: assessments.title, dueAt: assessments.dueAt, questionCount: assessments.questionCount, subjectName: subjects.name, subjectSlug: subjects.slug, topicIds: assessments.topicIds })
        .from(assessments)
        .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
        .where(and(eq(assessments.kind, "assigned"), eq(assessments.classId, profile.classId)))
        .orderBy(asc(assessments.dueAt))
    : [];
  const myResults = await db()
    .select({ id: assessmentResults.id, assessmentId: assessmentResults.assessmentId, percent: assessmentResults.percent, completedAt: assessmentResults.completedAt })
    .from(assessmentResults)
    .where(and(eq(assessmentResults.studentId, id), isNotNull(assessmentResults.completedAt)))
    .orderBy(desc(assessmentResults.completedAt));
  const latestFor = (assessmentId: number) => myResults.find((r) => r.assessmentId === assessmentId) ?? null;

  res.json({
    subjects: cat.map((s) => ({
      ...s,
      topics: s.topics.map((t) => {
        const g = gaps.find((x) => x.topicId === t.id);
        return { ...t, mastery: g?.mastery ?? null, status: g?.status ?? null };
      }),
    })),
    assigned: assigned.map((a) => ({ ...a, latest: latestFor(a.id) })),
  });
});

studentRouter.get("/results", async (req, res) => {
  const { assessmentResults, assessments, subjects } = schema;
  const rows = await db()
    .select({ id: assessmentResults.id, percent: assessmentResults.percent, score: assessmentResults.score, total: assessmentResults.total, completedAt: assessmentResults.completedAt, title: assessments.title, kind: assessments.kind, subjectName: subjects.name })
    .from(assessmentResults)
    .innerJoin(assessments, eq(assessments.id, assessmentResults.assessmentId))
    .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
    .where(and(eq(assessmentResults.studentId, req.user!.id), isNotNull(assessmentResults.completedAt)))
    .orderBy(desc(assessmentResults.completedAt));
  res.json(rows);
});

studentRouter.get("/results/:id", async (req, res) => {
  const detail = await resultDetail(parseId(req.params.id, "result id"));
  if (detail.result.studentId !== req.user!.id) throw notFound("Result");
  res.json(detail);
});

const startSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("diagnostic"), subjectId: z.coerce.number().int().positive() }),
  z.object({ mode: z.literal("practice"), topicId: z.coerce.number().int().positive() }),
  z.object({ mode: z.literal("assigned"), assessmentId: z.coerce.number().int().positive() }),
]);

const attemptLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  keyGenerator: (req) => `u${req.user!.id}`,
  message: { error: "Too many new attempts — please wait a minute." },
});

studentRouter.post("/attempts", attemptLimiter, async (req, res) => {
  const body = startSchema.parse(req.body);
  // Practice may call the AI to generate fresh questions for the student's weak concepts.
  if (body.mode === "practice") return res.status(201).json(await startPractice(req.user!.id, body.topicId));
  res.status(201).json({ ...(await startAttempt(req.user!.id, body)), source: "rules" });
});

studentRouter.get("/attempts/:id", async (req, res) => {
  res.json(await getOpenAttempt(req.user!.id, parseId(req.params.id, "attempt id")));
});

const submitSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.number().int().positive(), selectedIndex: z.number().int().min(0).max(9).nullable() }))
    .max(100),
});

studentRouter.post("/attempts/:id/submit", async (req, res) => {
  const { answers } = submitSchema.parse(req.body);
  const ids = answers.map((a) => a.questionId);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "Each question can only be answered once");
  res.json(await submitAttempt(req.user!.id, parseId(req.params.id, "attempt id"), answers));
});
