import { Router, type Request } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { and, eq, ne, inArray, desc, asc, isNotNull } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, notFound, forbidden } from "../middleware/errors.js";
import { parseId } from "../util.js";
import { classroomOverview, rosterFor, teacherClassIds, studentDashboard, studentProgress, gapsWithNames, describeGaps, studentProfile } from "../services/insights.js";
import { selectQuestions } from "../services/engine.js";
import { aiStudentSummary, AiUnavailable, type StudentSummary } from "../services/ai.js";
import { fallbackStudentSummary } from "../services/fallback.js";
import { logActivity } from "../services/activity.js";
import { resultDetail } from "../services/assessments.js";
import { config } from "../config.js";

export const teacherRouter = Router();
teacherRouter.use(requireRole("teacher", "admin"));

/** Teachers see their own classes; admins see everything. */
async function scope(req: Request): Promise<number[] | "all"> {
  return req.user!.role === "admin" ? "all" : teacherClassIds(req.user!.id);
}

async function assertStudentInScope(req: Request, studentId: number) {
  const [p] = await db()
    .select({ classId: schema.studentProfiles.classId })
    .from(schema.studentProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.studentProfiles.userId))
    .where(and(eq(schema.studentProfiles.userId, studentId), eq(schema.users.role, "student")));
  if (!p) throw notFound("Student");
  const s = await scope(req);
  if (s !== "all" && (p.classId === null || !s.includes(p.classId))) throw notFound("Student"); // don't reveal existence
}

teacherRouter.get("/overview", async (req, res) => {
  const s = await scope(req);
  const classes =
    s === "all"
      ? await db().select().from(schema.classes).orderBy(asc(schema.classes.name))
      : s.length
        ? await db().select().from(schema.classes).where(inArray(schema.classes.id, s)).orderBy(asc(schema.classes.name))
        : [];
  res.json({ classes, ...(await classroomOverview(s)) });
});

teacherRouter.get("/students", async (req, res) => {
  res.json(await rosterFor(await scope(req)));
});

teacherRouter.get("/students/:id", async (req, res) => {
  const id = parseId(req.params.id, "student id");
  await assertStudentInScope(req, id);
  const [dashboard, progress, gaps] = await Promise.all([studentDashboard(id), studentProgress(id), gapsWithNames(id)]);
  res.json({ dashboard, progress, gaps });
});

const summaryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 1000 : 15,
  keyGenerator: (req) => `u${req.user!.id}`,
  message: { error: "Too many report requests — please wait a minute." },
});
const summaryCache = new Map<number, { key: string; summary: StudentSummary; source: "ai" | "rules" }>();

teacherRouter.get("/students/:id/summary", summaryLimiter, async (req, res) => {
  const id = parseId(req.params.id, "student id");
  await assertStudentInScope(req, id);
  const gaps = await gapsWithNames(id);
  // Practice sets target weak concepts on purpose, so they're left out of the trend.
  const results = await db()
    .select({ title: schema.assessments.title, percent: schema.assessmentResults.percent })
    .from(schema.assessmentResults)
    .innerJoin(schema.assessments, eq(schema.assessments.id, schema.assessmentResults.assessmentId))
    .where(and(eq(schema.assessmentResults.studentId, id), isNotNull(schema.assessmentResults.completedAt), ne(schema.assessments.kind, "practice")))
    .orderBy(asc(schema.assessmentResults.completedAt));
  const key = `${gaps.map((g) => `${g.topicId}:${g.mastery}`).join("|")}#${results.length}`;
  const cached = summaryCache.get(id);
  if (cached?.key === key) return res.json({ summary: cached.summary, source: cached.source, generatedAt: new Date() });

  const profile = await studentProfile(id);
  let summary: StudentSummary;
  let source: "ai" | "rules" = "rules";
  try {
    if (!gaps.length) throw new AiUnavailable("No data");
    summary = await aiStudentSummary({ name: profile!.name, grade: profile!.grade, data: describeGaps(gaps, [...results].reverse()) });
    source = "ai";
  } catch (err) {
    if (!(err instanceof AiUnavailable)) throw err;
    summary = fallbackStudentSummary(profile!.name, gaps, results.map((r) => r.percent ?? 0));
  }
  summaryCache.set(id, { key, summary, source });
  res.json({ summary, source, generatedAt: new Date() });
});

// ---------------------------------------------------------------- assessments

teacherRouter.get("/questions", async (req, res) => {
  const topicIds = String(req.query.topicIds ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!topicIds.length) return res.json([]);
  const { questions, topics } = schema;
  const rows = await db()
    .select({ id: questions.id, prompt: questions.prompt, options: questions.options, correctIndex: questions.correctIndex, concept: questions.concept, difficulty: questions.difficulty, topicId: questions.topicId, topicName: topics.name })
    .from(questions)
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(and(inArray(questions.topicId, topicIds), eq(questions.source, "rules")))
    .orderBy(asc(questions.topicId), asc(questions.id));
  res.json(rows);
});

teacherRouter.get("/assessments", async (req, res) => {
  const s = await scope(req);
  if (s !== "all" && !s.length) return res.json([]);
  const { assessments, subjects, classes, assessmentResults, studentProfiles } = schema;
  const rows = await db()
    .select({ id: assessments.id, title: assessments.title, dueAt: assessments.dueAt, createdAt: assessments.createdAt, questionCount: assessments.questionCount, topicIds: assessments.topicIds, classId: assessments.classId, className: classes.name, subjectName: subjects.name, subjectSlug: subjects.slug, subjectColor: subjects.color })
    .from(assessments)
    .innerJoin(subjects, eq(subjects.id, assessments.subjectId))
    .leftJoin(classes, eq(classes.id, assessments.classId))
    .where(s === "all" ? eq(assessments.kind, "assigned") : and(eq(assessments.kind, "assigned"), inArray(assessments.classId, s)))
    .orderBy(desc(assessments.createdAt));
  const ids = rows.map((r) => r.id);
  const results = ids.length
    ? await db()
        .select({ assessmentId: assessmentResults.assessmentId, studentId: assessmentResults.studentId, percent: assessmentResults.percent })
        .from(assessmentResults)
        .where(and(inArray(assessmentResults.assessmentId, ids), isNotNull(assessmentResults.completedAt)))
    : [];
  const classSizes = await db().select({ classId: studentProfiles.classId }).from(studentProfiles);
  res.json(
    rows.map((r) => {
      const rs = results.filter((x) => x.assessmentId === r.id);
      const students = new Set(rs.map((x) => x.studentId));
      return {
        ...r,
        completedBy: students.size,
        classSize: classSizes.filter((c) => c.classId === r.classId).length,
        averageScore: rs.length ? Math.round(rs.reduce((n, x) => n + (x.percent ?? 0), 0) / rs.length) : null,
      };
    }),
  );
});

const createSchema = z.object({
  title: z.string().trim().min(3, "Give the assessment a title").max(160),
  classId: z.coerce.number().int().positive({ message: "Choose a class" }),
  subjectId: z.coerce.number().int().positive({ message: "Choose a subject" }),
  topicIds: z.array(z.coerce.number().int().positive()).min(1, "Pick at least one topic").max(20),
  questionCount: z.coerce.number().int().min(3, "At least 3 questions").max(30, "At most 30 questions"),
  questionIds: z.array(z.number().int().positive()).max(30).optional(),
  dueAt: z
    .string()
    .datetime({ offset: true, message: "Invalid date" })
    .nullable()
    .optional()
    .refine((v) => !v || new Date(v).getTime() > Date.now() - 864e5, "Due date can't be in the past"),
});

teacherRouter.post("/assessments", async (req, res) => {
  const body = createSchema.parse(req.body);
  const s = await scope(req);
  if (s !== "all" && !s.includes(body.classId)) throw forbidden();
  const [cls] = await db().select().from(schema.classes).where(eq(schema.classes.id, body.classId));
  if (!cls) throw new HttpError(400, "That class does not exist");
  const subjectTopics = await db().select({ id: schema.topics.id }).from(schema.topics).where(eq(schema.topics.subjectId, body.subjectId));
  const valid = new Set(subjectTopics.map((t) => t.id));
  if (!body.topicIds.every((t) => valid.has(t))) throw new HttpError(400, "All topics must belong to the chosen subject", { fields: { topicIds: "Topics must belong to the subject" } });

  const pool = await db()
    .select({ id: schema.questions.id, topicId: schema.questions.topicId, concept: schema.questions.concept, difficulty: schema.questions.difficulty })
    .from(schema.questions)
    .where(and(inArray(schema.questions.topicId, body.topicIds), eq(schema.questions.source, "rules")));
  let questionIds: number[];
  if (body.questionIds?.length) {
    const poolIds = new Set(pool.map((q) => q.id));
    if (!body.questionIds.every((id) => poolIds.has(id))) throw new HttpError(400, "Selected questions must come from the chosen topics");
    questionIds = [...new Set(body.questionIds)];
  } else {
    questionIds = selectQuestions({ pool, topicIds: body.topicIds, count: Math.min(body.questionCount, pool.length), mastery: new Map(), weakConcepts: new Map(), recentlySeen: new Set() });
  }
  if (questionIds.length < 3) throw new HttpError(422, "Not enough questions in those topics — choose more topics", { fields: { topicIds: "Not enough questions" } });

  const created = await db().transaction(async (tx) => {
    const [a] = await tx
      .insert(schema.assessments)
      .values({ title: body.title, kind: "assigned", subjectId: body.subjectId, topicIds: body.topicIds, questionCount: questionIds.length, classId: body.classId, createdBy: req.user!.id, dueAt: body.dueAt ? new Date(body.dueAt) : null })
      .returning();
    await tx.insert(schema.assessmentQuestions).values(questionIds.map((questionId, position) => ({ assessmentId: a.id, questionId, position })));
    return a;
  });
  await logActivity(req.user!.id, "assign", `assigned "${created.title}" to ${cls.name}`);
  res.status(201).json(created);
});

async function assessmentInScope(req: Request, id: number) {
  const [a] = await db().select().from(schema.assessments).where(and(eq(schema.assessments.id, id), eq(schema.assessments.kind, "assigned")));
  if (!a) throw notFound("Assessment");
  const s = await scope(req);
  if (s !== "all" && (a.classId === null || !s.includes(a.classId))) throw notFound("Assessment");
  return a;
}

teacherRouter.get("/assessments/:id/results", async (req, res) => {
  const a = await assessmentInScope(req, parseId(req.params.id, "assessment id"));
  const { users, studentProfiles, assessmentResults, assessmentQuestions, questions, topics, studentAnswers } = schema;
  const students = await db()
    .select({ id: users.id, name: users.name, avatarColor: studentProfiles.avatarColor })
    .from(users)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(and(eq(studentProfiles.classId, a.classId!), eq(users.role, "student")))
    .orderBy(asc(users.name));
  const attempts = await db()
    .select()
    .from(assessmentResults)
    .where(and(eq(assessmentResults.assessmentId, a.id), isNotNull(assessmentResults.completedAt)))
    .orderBy(desc(assessmentResults.completedAt));
  const qs = await db()
    .select({ id: questions.id, prompt: questions.prompt, concept: questions.concept, difficulty: questions.difficulty, topicName: topics.name, position: assessmentQuestions.position })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(questions.id, assessmentQuestions.questionId))
    .innerJoin(topics, eq(topics.id, questions.topicId))
    .where(eq(assessmentQuestions.assessmentId, a.id))
    .orderBy(asc(assessmentQuestions.position));
  const attemptIds = attempts.map((x) => x.id);
  const answers = attemptIds.length ? await db().select({ questionId: studentAnswers.questionId, isCorrect: studentAnswers.isCorrect }).from(studentAnswers).where(inArray(studentAnswers.resultId, attemptIds)) : [];

  res.json({
    assessment: a,
    students: students.map((s) => {
      const mine = attempts.filter((x) => x.studentId === s.id);
      return { ...s, attempts: mine.length, latest: mine[0] ? { resultId: mine[0].id, percent: mine[0].percent, score: mine[0].score, total: mine[0].total, completedAt: mine[0].completedAt } : null, best: mine.length ? Math.max(...mine.map((x) => x.percent ?? 0)) : null };
    }),
    items: qs.map((q) => {
      const as = answers.filter((x) => x.questionId === q.id);
      return { ...q, answered: as.length, percentCorrect: as.length ? Math.round((as.filter((x) => x.isCorrect).length / as.length) * 100) : null };
    }),
  });
});

teacherRouter.get("/results/:id", async (req, res) => {
  const detail = await resultDetail(parseId(req.params.id, "result id"));
  await assertStudentInScope(req, detail.result.studentId);
  res.json(detail);
});

teacherRouter.delete("/assessments/:id", async (req, res) => {
  const a = await assessmentInScope(req, parseId(req.params.id, "assessment id"));
  // Students' answers feed their mastery history; never delete them as a side effect.
  const [taken] = await db().select({ id: schema.assessmentResults.id }).from(schema.assessmentResults).where(eq(schema.assessmentResults.assessmentId, a.id)).limit(1);
  if (taken) throw new HttpError(409, "Students have already started this assessment, so it can't be deleted.");
  await db().delete(schema.assessments).where(eq(schema.assessments.id, a.id));
  await logActivity(req.user!.id, "assign", `removed the assessment "${a.title}"`);
  res.json({ ok: true });
});
