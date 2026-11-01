import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, desc, asc, sql, gte, isNotNull, ilike, or, inArray } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireRole } from "../middleware/auth.js";
import { HttpError, notFound } from "../middleware/errors.js";
import { parseId } from "../util.js";
import { passwordSchema } from "./auth.js";
import { average, dayKey } from "../services/engine.js";
import { logActivity } from "../services/activity.js";
import { invalidateKnowledgeCache } from "../services/fallback.js";
import { aiEnabled } from "../config.js";

export const adminRouter = Router();
adminRouter.use(requireRole("admin"));

const { users, studentProfiles, teacherProfiles, classes, subjects, topics, lessons, questions, assessmentResults, knowledgeGaps, activityLog, studentAnswers } = schema;

adminRouter.get("/stats", async (_req, res) => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);
  const roleCounts = await db().select({ role: users.role, count: sql<number>`count(*)::int`, active: sql<number>`count(*) filter (where ${users.isActive})::int` }).from(users).groupBy(users.role);
  const [{ total, week }] = await db()
    .select({ total: sql<number>`count(*)::int`, week: sql<number>`count(*) filter (where ${assessmentResults.completedAt} >= ${weekAgo.toISOString()})::int` })
    .from(assessmentResults)
    .where(isNotNull(assessmentResults.completedAt));
  const [{ activeStudents }] = await db()
    .select({ activeStudents: sql<number>`count(distinct ${assessmentResults.studentId})::int` })
    .from(assessmentResults)
    .where(gte(assessmentResults.completedAt, weekAgo));
  const [{ answers }] = await db().select({ answers: sql<number>`count(*)::int` }).from(studentAnswers);
  const content = {
    subjects: (await db().select({ c: sql<number>`count(*)::int` }).from(subjects))[0].c,
    topics: (await db().select({ c: sql<number>`count(*)::int` }).from(topics))[0].c,
    lessons: (await db().select({ c: sql<number>`count(*)::int` }).from(lessons))[0].c,
    questions: (await db().select({ c: sql<number>`count(*)::int` }).from(questions).where(eq(questions.source, "rules")))[0].c,
    aiQuestions: (await db().select({ c: sql<number>`count(*)::int` }).from(questions).where(eq(questions.source, "ai")))[0].c,
  };
  const subjectMastery = await db()
    .select({ id: subjects.id, name: subjects.name, slug: subjects.slug, color: subjects.color, avg: sql<number | null>`avg(${knowledgeGaps.mastery})::float`, weak: sql<number>`count(*) filter (where ${knowledgeGaps.status} = 'weak')::int` })
    .from(subjects)
    .leftJoin(topics, eq(topics.subjectId, subjects.id))
    .leftJoin(knowledgeGaps, eq(knowledgeGaps.topicId, topics.id))
    .groupBy(subjects.id)
    .orderBy(asc(subjects.id));
  const statusMix = await db().select({ status: knowledgeGaps.status, count: sql<number>`count(*)::int` }).from(knowledgeGaps).groupBy(knowledgeGaps.status);
  const recent = await db()
    .select({ completedAt: assessmentResults.completedAt, percent: assessmentResults.percent })
    .from(assessmentResults)
    .where(gte(assessmentResults.completedAt, new Date(now.getTime() - 15 * 864e5)));
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = dayKey(new Date(now.getTime() - (13 - i) * 864e5));
    const rs = recent.filter((r) => r.completedAt && dayKey(r.completedAt) === d);
    return { date: d, assessments: rs.length, average: average(rs.map((r) => r.percent ?? 0)) };
  });
  const [{ platformMastery }] = await db().select({ platformMastery: sql<number | null>`avg(${knowledgeGaps.mastery})::float` }).from(knowledgeGaps);

  res.json({
    users: Object.fromEntries(roleCounts.map((r) => [r.role, { total: r.count, active: r.active }])),
    assessments: { total, week },
    activeStudents,
    answers,
    content,
    platformMastery: platformMastery === null ? null : Math.round(platformMastery * 10) / 10,
    subjectMastery: subjectMastery.map((s) => ({ ...s, avg: s.avg === null ? null : Math.round(s.avg * 10) / 10 })),
    statusMix,
    daily,
    aiMode: aiEnabled() ? "ai" : "offline",
  });
});

adminRouter.get("/activity", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rows = await db()
    .select({ id: activityLog.id, type: activityLog.type, message: activityLog.message, createdAt: activityLog.createdAt, userName: users.name, userRole: users.role })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.userId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
  res.json(rows);
});

// ---------------------------------------------------------------- users

adminRouter.get("/users", async (req, res) => {
  const role = z.enum(["student", "teacher", "admin"]).optional().catch(undefined).parse(req.query.role);
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const filters = [];
  if (role) filters.push(eq(users.role, role));
  if (q) filters.push(or(ilike(users.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`), ilike(users.email, `%${q.replace(/[%_\\]/g, "\\$&")}%`))!);
  const rows = await db()
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, classId: studentProfiles.classId, className: classes.name, grade: studentProfiles.grade, department: teacherProfiles.department })
    .from(users)
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .leftJoin(classes, eq(classes.id, studentProfiles.classId))
    .leftJoin(teacherProfiles, eq(teacherProfiles.userId, users.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(users.role), asc(users.name));
  res.json(rows);
});

const createUser = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  password: passwordSchema,
  role: z.enum(["student", "teacher", "admin"]),
  grade: z.coerce.number().int().min(6).max(12).optional(),
  classId: z.coerce.number().int().positive().nullable().optional(),
  department: z.string().trim().max(80).optional(),
});

async function ensureProfile(tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0], userId: number, role: string, opts: { grade?: number; classId?: number | null; department?: string }) {
  if (role === "student") {
    await tx.insert(studentProfiles).values({ userId, grade: opts.grade ?? 8, classId: opts.classId ?? null }).onConflictDoNothing();
  } else if (role === "teacher") {
    await tx.insert(teacherProfiles).values({ userId, department: opts.department || "General" }).onConflictDoNothing();
  }
}

adminRouter.post("/users", async (req, res) => {
  const body = createUser.parse(req.body);
  const [dupe] = await db().select({ id: users.id }).from(users).where(eq(users.email, body.email));
  if (dupe) throw new HttpError(409, "An account with this email already exists", { fields: { email: "Already registered" } });
  const u = await db().transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ name: body.name, email: body.email, role: body.role, passwordHash: await bcrypt.hash(body.password, 12) }).returning();
    await ensureProfile(tx, u.id, body.role, body);
    return u;
  });
  await logActivity(req.user!.id, "admin", `created ${body.role} account for ${body.name}`);
  res.status(201).json({ id: u.id });
});

const patchUser = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["student", "teacher", "admin"]).optional(),
  isActive: z.boolean().optional(),
  classId: z.coerce.number().int().positive().nullable().optional(),
  password: passwordSchema.optional(),
});

adminRouter.patch("/users/:id", async (req, res) => {
  const id = parseId(req.params.id, "user id");
  const body = patchUser.parse(req.body);
  const [u] = await db().select().from(users).where(eq(users.id, id));
  if (!u) throw notFound("User");
  if (id === req.user!.id && (body.role && body.role !== "admin" || body.isActive === false))
    throw new HttpError(400, "You can't remove your own admin access or deactivate yourself");
  if (body.classId) {
    const [c] = await db().select().from(classes).where(eq(classes.id, body.classId));
    if (!c) throw new HttpError(400, "That class does not exist");
  }
  await db().transaction(async (tx) => {
    const set: Partial<typeof users.$inferInsert> = {};
    if (body.name) set.name = body.name;
    if (body.role) set.role = body.role;
    if (body.isActive !== undefined) set.isActive = body.isActive;
    if (body.password) set.passwordHash = await bcrypt.hash(body.password, 12);
    // Password reset, deactivation or a role change ends the user's existing sessions.
    if (body.password || body.isActive === false || (body.role && body.role !== u.role)) set.sessionVersion = u.sessionVersion + 1;
    if (Object.keys(set).length) await tx.update(users).set(set).where(eq(users.id, id));
    if (body.role && body.role !== u.role) await ensureProfile(tx, id, body.role, {});
    if (body.classId !== undefined) await tx.update(studentProfiles).set({ classId: body.classId }).where(eq(studentProfiles.userId, id));
  });
  const changes = [body.role && body.role !== u.role ? `role → ${body.role}` : "", body.isActive === false ? "deactivated" : body.isActive === true && !u.isActive ? "reactivated" : "", body.password ? "password reset" : "", body.classId !== undefined ? "class changed" : ""].filter(Boolean);
  await logActivity(req.user!.id, "admin", `updated ${u.name}${changes.length ? ` (${changes.join(", ")})` : ""}`);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- classes

adminRouter.get("/classes", async (_req, res) => {
  const rows = await db()
    .select({ id: classes.id, name: classes.name, grade: classes.grade, teacherId: classes.teacherId, teacherName: users.name, students: sql<number>`(select count(*)::int from ${studentProfiles} where ${studentProfiles.classId} = ${classes.id})` })
    .from(classes)
    .leftJoin(users, eq(users.id, classes.teacherId))
    .orderBy(asc(classes.name));
  res.json(rows);
});

const classSchema = z.object({
  name: z.string().trim().min(2, "Enter a class name").max(80),
  grade: z.coerce.number().int().min(6).max(12),
  teacherId: z.coerce.number().int().positive().nullable().optional(),
});

async function assertTeacher(id: number | null | undefined) {
  if (!id) return;
  const [t] = await db().select({ role: users.role }).from(users).where(eq(users.id, id));
  if (!t || t.role !== "teacher") throw new HttpError(400, "Choose a teacher account", { fields: { teacherId: "Must be a teacher" } });
}

adminRouter.post("/classes", async (req, res) => {
  const body = classSchema.parse(req.body);
  await assertTeacher(body.teacherId);
  const [c] = await db().insert(classes).values({ name: body.name, grade: body.grade, teacherId: body.teacherId ?? null }).returning();
  await logActivity(req.user!.id, "admin", `created class ${c.name}`);
  res.status(201).json(c);
});

adminRouter.patch("/classes/:id", async (req, res) => {
  const id = parseId(req.params.id, "class id");
  const body = classSchema.partial().parse(req.body);
  await assertTeacher(body.teacherId);
  const updated = await db().update(classes).set(body).where(eq(classes.id, id)).returning();
  if (!updated.length) throw notFound("Class");
  await logActivity(req.user!.id, "admin", `updated class ${updated[0].name}`);
  res.json(updated[0]);
});

// ---------------------------------------------------------------- content

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";

const subjectSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  description: z.string().trim().max(500).default(""),
  color: z.enum(["indigo", "emerald", "violet", "sky", "amber", "rose", "teal"]).default("indigo"),
});

adminRouter.post("/subjects", async (req, res) => {
  const body = subjectSchema.parse(req.body);
  let slug = slugify(body.name);
  if ((await db().select().from(subjects).where(eq(subjects.slug, slug))).length) slug = `${slug}-${Date.now().toString(36)}`;
  const [s] = await db().insert(subjects).values({ ...body, slug, icon: "BookOpen" }).returning();
  invalidateKnowledgeCache();
  await logActivity(req.user!.id, "content", `added subject ${s.name}`);
  res.status(201).json(s);
});

adminRouter.patch("/subjects/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const body = subjectSchema.partial().parse(req.body);
  const updated = await db().update(subjects).set(body).where(eq(subjects.id, id)).returning();
  if (!updated.length) throw notFound("Subject");
  invalidateKnowledgeCache();
  res.json(updated[0]);
});

/** Deleting content would cascade into students' answer history, so only unused content can be removed. */
async function assertNoAnswers(topicIds: number[]) {
  if (!topicIds.length) return;
  const [used] = await db().select({ id: studentAnswers.id }).from(studentAnswers).where(inArray(studentAnswers.topicId, topicIds)).limit(1);
  if (used) throw new HttpError(409, "Students have already answered questions here, so it can't be deleted. Edit it instead.");
}

adminRouter.delete("/subjects/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const ts = await db().select({ id: topics.id }).from(topics).where(eq(topics.subjectId, id));
  await assertNoAnswers(ts.map((t) => t.id));
  const deleted = await db().delete(subjects).where(eq(subjects.id, id)).returning();
  if (!deleted.length) throw notFound("Subject");
  invalidateKnowledgeCache();
  await logActivity(req.user!.id, "content", `deleted subject ${deleted[0].name}`);
  res.json({ ok: true });
});

const topicSchema = z.object({
  subjectId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2, "Enter a name").max(120),
  description: z.string().trim().max(500).default(""),
});

adminRouter.post("/topics", async (req, res) => {
  const body = topicSchema.parse(req.body);
  const [s] = await db().select().from(subjects).where(eq(subjects.id, body.subjectId));
  if (!s) throw new HttpError(400, "That subject does not exist");
  let slug = slugify(body.name);
  if ((await db().select().from(topics).where(and(eq(topics.subjectId, s.id), eq(topics.slug, slug)))).length) slug = `${slug}-${Date.now().toString(36)}`;
  const [{ max }] = await db().select({ max: sql<number>`coalesce(max(${topics.sortOrder}), 0)::int` }).from(topics).where(eq(topics.subjectId, s.id));
  const [t] = await db().insert(topics).values({ ...body, slug, sortOrder: max + 1 }).returning();
  invalidateKnowledgeCache();
  await logActivity(req.user!.id, "content", `added topic ${t.name} to ${s.name}`);
  res.status(201).json(t);
});

adminRouter.patch("/topics/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const body = topicSchema.omit({ subjectId: true }).partial().parse(req.body);
  const updated = await db().update(topics).set(body).where(eq(topics.id, id)).returning();
  if (!updated.length) throw notFound("Topic");
  invalidateKnowledgeCache();
  res.json(updated[0]);
});

adminRouter.delete("/topics/:id", async (req, res) => {
  const id = parseId(req.params.id);
  await assertNoAnswers([id]);
  const deleted = await db().delete(topics).where(eq(topics.id, id)).returning();
  if (!deleted.length) throw notFound("Topic");
  invalidateKnowledgeCache();
  await logActivity(req.user!.id, "content", `deleted topic ${deleted[0].name}`);
  res.json({ ok: true });
});

const lessonSchema = z.object({
  topicId: z.coerce.number().int().positive(),
  title: z.string().trim().min(3, "Enter a title").max(160),
  summary: z.string().trim().min(10, "Write a short summary").max(500),
  content: z.string().trim().min(20, "Write the lesson content").max(20000),
  keyPoints: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  example: z.string().trim().max(2000).default(""),
  durationMinutes: z.coerce.number().int().min(1).max(120).default(10),
  level: z.enum(["easy", "medium", "hard"]).default("easy"),
});

adminRouter.get("/lessons/:id", async (req, res) => {
  const [l] = await db().select().from(lessons).where(eq(lessons.id, parseId(req.params.id)));
  if (!l) throw notFound("Lesson");
  res.json(l);
});

adminRouter.post("/lessons", async (req, res) => {
  const body = lessonSchema.parse(req.body);
  const [t] = await db().select().from(topics).where(eq(topics.id, body.topicId));
  if (!t) throw new HttpError(400, "That topic does not exist");
  const [l] = await db().insert(lessons).values(body).returning();
  invalidateKnowledgeCache();
  await logActivity(req.user!.id, "content", `published lesson "${l.title}"`);
  res.status(201).json(l);
});

adminRouter.patch("/lessons/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const body = lessonSchema.partial().parse(req.body);
  const updated = await db().update(lessons).set({ ...body, updatedAt: new Date() }).where(eq(lessons.id, id)).returning();
  if (!updated.length) throw notFound("Lesson");
  invalidateKnowledgeCache();
  await logActivity(req.user!.id, "content", `edited lesson "${updated[0].title}"`);
  res.json(updated[0]);
});

adminRouter.delete("/lessons/:id", async (req, res) => {
  const deleted = await db().delete(lessons).where(eq(lessons.id, parseId(req.params.id))).returning();
  if (!deleted.length) throw notFound("Lesson");
  invalidateKnowledgeCache();
  await logActivity(req.user!.id, "content", `deleted lesson "${deleted[0].title}"`);
  res.json({ ok: true });
});

adminRouter.get("/questions", async (req, res) => {
  const topicId = parseId(req.query.topicId, "topic id");
  res.json(await db().select().from(questions).where(eq(questions.topicId, topicId)).orderBy(asc(questions.id)));
});

const questionSchema = z
  .object({
    topicId: z.coerce.number().int().positive(),
    concept: z.string().trim().min(2, "Name the concept this tests").max(120),
    difficulty: z.enum(["easy", "medium", "hard"]),
    prompt: z.string().trim().min(5, "Write the question").max(1000),
    options: z.array(z.string().trim().min(1, "Options can't be empty").max(300)).min(2).max(6),
    correctIndex: z.coerce.number().int().min(0),
    explanation: z.string().trim().min(5, "Explain the answer").max(2000),
  })
  .refine((q) => q.correctIndex < q.options.length, { path: ["correctIndex"], message: "Pick the correct option" })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, { path: ["options"], message: "Options must be different" });

adminRouter.post("/questions", async (req, res) => {
  const body = questionSchema.parse(req.body);
  const [t] = await db().select().from(topics).where(eq(topics.id, body.topicId));
  if (!t) throw new HttpError(400, "That topic does not exist");
  const [q] = await db().insert(questions).values({ ...body, source: "rules", createdBy: req.user!.id }).returning();
  invalidateKnowledgeCache();
  await logActivity(req.user!.id, "content", `added a question to ${t.name}`);
  res.status(201).json(q);
});

adminRouter.delete("/questions/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [used] = await db().select({ id: studentAnswers.id }).from(studentAnswers).where(eq(studentAnswers.questionId, id)).limit(1);
  if (used) throw new HttpError(409, "Students have answered this question, so it can't be deleted.");
  const deleted = await db().delete(questions).where(eq(questions.id, id)).returning();
  if (!deleted.length) throw notFound("Question");
  invalidateKnowledgeCache();
  res.json({ ok: true });
});
