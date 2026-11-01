import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { notFound } from "../middleware/errors.js";
import { catalog } from "../services/insights.js";
import { parseId } from "../util.js";

export const catalogRouter = Router();
catalogRouter.use(requireAuth);

catalogRouter.get("/subjects", async (_req, res) => {
  res.json(await catalog());
});

catalogRouter.get("/lessons", async (req, res) => {
  const { lessons, topics, subjects, lessonProgress } = schema;
  const rows = await db()
    .select({
      id: lessons.id,
      title: lessons.title,
      summary: lessons.summary,
      durationMinutes: lessons.durationMinutes,
      level: lessons.level,
      topicId: lessons.topicId,
      topicName: topics.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectSlug: subjects.slug,
      color: subjects.color,
    })
    .from(lessons)
    .innerJoin(topics, eq(topics.id, lessons.topicId))
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .orderBy(asc(subjects.id), asc(topics.sortOrder), asc(lessons.id));
  const done =
    req.user!.role === "student"
      ? new Set((await db().select({ id: lessonProgress.lessonId }).from(lessonProgress).where(eq(lessonProgress.studentId, req.user!.id))).map((r) => r.id))
      : new Set<number>();
  res.json(rows.map((r) => ({ ...r, completed: done.has(r.id) })));
});

catalogRouter.get("/lessons/:id", async (req, res) => {
  const id = parseId(req.params.id, "lesson id");
  const { lessons, topics, subjects, lessonProgress } = schema;
  const [l] = await db()
    .select({ lesson: lessons, topicName: topics.name, subjectName: subjects.name, subjectSlug: subjects.slug, color: subjects.color })
    .from(lessons)
    .innerJoin(topics, eq(topics.id, lessons.topicId))
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(eq(lessons.id, id));
  if (!l) throw notFound("Lesson");
  let completedAt: Date | null = null;
  let recommended = false;
  if (req.user!.role === "student") {
    const [p] = await db().select().from(lessonProgress).where(and(eq(lessonProgress.studentId, req.user!.id), eq(lessonProgress.lessonId, id)));
    completedAt = p?.completedAt ?? null;
    // A lesson studied before the latest assessment can be recommended again.
    const [rec] = await db()
      .select({ id: schema.recommendations.id })
      .from(schema.recommendations)
      .where(and(eq(schema.recommendations.studentId, req.user!.id), eq(schema.recommendations.lessonId, id), eq(schema.recommendations.status, "pending")))
      .limit(1);
    recommended = Boolean(rec);
  }
  res.json({ ...l.lesson, topicName: l.topicName, subjectName: l.subjectName, subjectSlug: l.subjectSlug, color: l.color, completedAt, recommended });
});
