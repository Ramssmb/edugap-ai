import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { initDb, db, schema, closeDb } from "./index.js";
import { curriculum } from "../data/curriculum.js";
import { startAttempt, submitAttempt } from "../services/assessments.js";
import { completeLesson } from "../services/learning.js";
import { logActivity } from "../services/activity.js";

/**
 * Demo data. Student histories are not written directly: each simulated student
 * takes real assessments through the same grading pipeline the app uses, so every
 * knowledge gap, recommendation and chart is derived from actual answers.
 */

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "EduGap@2026";

// Deterministic PRNG so the demo looks the same on every machine.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ability = Record<string, number>; // topic slug -> base probability of a correct answer

type DemoStudent = {
  name: string;
  email: string;
  cls: "A" | "B";
  lang: "en" | "hi" | "pa" | "te";
  base: number;
  overrides: Ability;
  /** Added to ability on each successive diagnostic, so some students visibly improve. */
  growth: number;
};

const students: DemoStudent[] = [
  // The primary demo account: strong in English, clear gaps in fractions and percentages.
  { name: "Aarav Patel", email: "aarav@edugap.demo", cls: "A", lang: "en", base: 0.68, overrides: { fractions: 0.3, percentages: 0.35, electricity: 0.5, tenses: 0.85, punctuation: 0.82 }, growth: 0.02 },
  { name: "Diya Sharma", email: "diya@edugap.demo", cls: "A", lang: "hi", base: 0.88, overrides: { geometry: 0.7 }, growth: 0.02 },
  { name: "Kabir Singh", email: "kabir@edugap.demo", cls: "A", lang: "pa", base: 0.45, overrides: { "linear-equations": 0.25, matter: 0.6, voice: 0.3 }, growth: 0.06 },
  { name: "Ananya Reddy", email: "ananya@edugap.demo", cls: "A", lang: "te", base: 0.75, overrides: { "force-motion": 0.45, electricity: 0.4 }, growth: 0.04 },
  { name: "Vihaan Gupta", email: "vihaan@edugap.demo", cls: "A", lang: "en", base: 0.58, overrides: { "parts-of-speech": 0.35, punctuation: 0.4, fractions: 0.8 }, growth: 0.0 },
  { name: "Ishita Nair", email: "ishita@edugap.demo", cls: "A", lang: "en", base: 0.36, overrides: { cells: 0.6 }, growth: -0.03 },
  { name: "Arjun Mehta", email: "arjun@edugap.demo", cls: "B", lang: "hi", base: 0.8, overrides: { tenses: 0.5, voice: 0.45 }, growth: 0.03 },
  { name: "Meera Iyer", email: "meera@edugap.demo", cls: "B", lang: "en", base: 0.92, overrides: {}, growth: 0.01 },
  { name: "Rohan Das", email: "rohan@edugap.demo", cls: "B", lang: "en", base: 0.5, overrides: { geometry: 0.3, percentages: 0.35, cells: 0.75 }, growth: 0.05 },
  { name: "Saanvi Kaur", email: "saanvi@edugap.demo", cls: "B", lang: "pa", base: 0.64, overrides: { matter: 0.35, "force-motion": 0.4 }, growth: 0.07 },
  { name: "Aditya Rao", email: "aditya@edugap.demo", cls: "B", lang: "te", base: 0.42, overrides: { fractions: 0.25, "linear-equations": 0.3 }, growth: 0.0 },
  { name: "Priya Menon", email: "priya@edugap.demo", cls: "B", lang: "en", base: 0.72, overrides: { punctuation: 0.45 }, growth: 0.04 },
];

const DIFF_SHIFT = { easy: 0.15, medium: 0, hard: -0.15 } as const;
const COLORS = ["indigo", "violet", "sky", "emerald", "amber", "rose", "teal", "fuchsia"];

export async function seed({ reset }: { reset: boolean }) {
  await initDb();
  if (reset) {
    await db().execute(
      sql.raw(
        `TRUNCATE activity_log, progress_records, lesson_progress, recommendations, knowledge_gaps, student_answers, assessment_results, assessment_questions, assessments, lessons, questions, topics, subjects, student_profiles, teacher_profiles, classes, users RESTART IDENTITY CASCADE`,
      ),
    );
  }
  const rand = mulberry32(20261101);
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { users, teacherProfiles, studentProfiles, classes, subjects, topics, lessons, questions, assessments, assessmentQuestions } = schema;

  // ---- curriculum
  const topicBySlug = new Map<string, { id: number; subjectId: number }>();
  const lessonByTopic = new Map<number, number>();
  for (const s of curriculum) {
    const [sub] = await db().insert(subjects).values({ slug: s.slug, name: s.name, description: s.description, color: s.color, icon: s.icon }).returning();
    for (const [i, t] of s.topics.entries()) {
      const [top] = await db().insert(topics).values({ subjectId: sub.id, slug: t.slug, name: t.name, description: t.description, sortOrder: i }).returning();
      topicBySlug.set(t.slug, { id: top.id, subjectId: sub.id });
      const [les] = await db().insert(lessons).values({ topicId: top.id, ...t.lesson, level: "easy" }).returning();
      lessonByTopic.set(top.id, les.id);
      await db()
        .insert(questions)
        .values(t.questions.map(([concept, difficulty, prompt, options, correctIndex, explanation]) => ({ topicId: top.id, concept, difficulty, prompt, options, correctIndex, explanation })));
    }
  }

  // ---- people
  const [admin] = await db().insert(users).values({ name: "Neha Kapoor", email: "admin@edugap.demo", passwordHash: hash, role: "admin" }).returning();
  const [t1] = await db().insert(users).values({ name: "Anita Sharma", email: "anita.sharma@edugap.demo", passwordHash: hash, role: "teacher" }).returning();
  const [t2] = await db().insert(users).values({ name: "Rahul Verma", email: "rahul.verma@edugap.demo", passwordHash: hash, role: "teacher" }).returning();
  await db().insert(teacherProfiles).values([
    { userId: t1.id, department: "Mathematics", bio: "Class teacher, Grade 8-A. Loves making algebra click." },
    { userId: t2.id, department: "Science", bio: "Class teacher, Grade 8-B. Hands-on experiments every Friday." },
  ]);
  const [cA] = await db().insert(classes).values({ name: "Grade 8-A", grade: 8, teacherId: t1.id }).returning();
  const [cB] = await db().insert(classes).values({ name: "Grade 8-B", grade: 8, teacherId: t2.id }).returning();

  const now = Date.now();
  const day = 864e5;
  const at = (daysAgo: number, hour: number) => {
    const d = new Date(now - daysAgo * day);
    d.setUTCHours(hour, Math.floor(rand() * 60), 0, 0);
    return d;
  };

  const subjectIds = [...new Set([...topicBySlug.values()].map((t) => t.subjectId))];
  const qMeta = new Map(
    (await db().select({ id: questions.id, difficulty: questions.difficulty, correctIndex: questions.correctIndex, options: questions.options, topicId: questions.topicId }).from(questions)).map((q) => [q.id, q]),
  );
  const slugByTopicId = new Map([...topicBySlug.entries()].map(([slug, t]) => [t.id, slug]));

  /**
   * Simulate a student answering: correct with probability = ability. Error
   * diffusion per (student, topic) keeps the realised accuracy close to that
   * ability, so a handful of answers per topic doesn't produce wild swings.
   */
  const carry = new Map<string, number>();
  const answer = (st: DemoStudent, questionIds: number[], boost: number) =>
    questionIds.map((qid) => {
      const q = qMeta.get(qid)!;
      const slug = slugByTopicId.get(q.topicId)!;
      const p = Math.min(0.97, Math.max(0.05, (st.overrides[slug] ?? st.base) + DIFF_SHIFT[q.difficulty] + boost));
      const key = `${st.email}:${slug}`;
      const acc = (carry.get(key) ?? rand() * 0.5) + p + (rand() - 0.5) * 0.3;
      const correct = acc >= 1;
      carry.set(key, correct ? acc - 1 : acc);
      const wrong = [...q.options.keys()].filter((i) => i !== q.correctIndex);
      return { questionId: qid, selectedIndex: correct ? q.correctIndex : wrong[Math.floor(rand() * wrong.length)] };
    });

  for (const [i, st] of students.entries()) {
    const [u] = await db().insert(users).values({ name: st.name, email: st.email, passwordHash: hash, role: "student", createdAt: new Date(now - 35 * day), lastLoginAt: at(1, 15) }).returning();
    await db().insert(studentProfiles).values({ userId: u.id, grade: 8, classId: st.cls === "A" ? cA.id : cB.id, preferredLanguage: st.lang, dailyQuestionGoal: 10, avatarColor: COLORS[i % COLORS.length] });
    await logActivity(u.id, "register", "joined as a student", new Date(now - 35 * day));

    // Three rounds of diagnostics per subject, with study in between.
    const rounds = [27, 17, 8];
    for (const [r, daysAgo] of rounds.entries()) {
      for (const [k, subjectId] of subjectIds.entries()) {
        // Aarav skips the final maths round so the demo starts with his gaps still open.
        if (st.email === "aarav@edugap.demo" && r === 2 && k === 0) continue;
        const when = at(daysAgo - k, 10 + k * 2);
        const attempt = await startAttempt(u.id, { mode: "diagnostic", subjectId }, undefined, when);
        await submitAttempt(u.id, attempt.resultId, answer(st, attempt.questions.map((q) => q.id), st.growth * r), new Date(when.getTime() + 12 * 60_000));
      }
      // Between rounds, motivated students study their weakest recommended lesson and practise it.
      if (r < 2 && st.growth > 0) {
        const recs = await db()
          .select({ lessonId: schema.recommendations.lessonId, topicId: schema.recommendations.topicId })
          .from(schema.recommendations)
          .where(and(eq(schema.recommendations.studentId, u.id), eq(schema.recommendations.status, "pending"), eq(schema.recommendations.type, "lesson")))
          .orderBy(schema.recommendations.priority)
          .limit(2);
        for (const [j, rec] of recs.entries()) {
          const studyDay = rounds[r] - 3 - j * 2;
          if (rec.lessonId) {
            await completeLesson(u.id, rec.lessonId, at(studyDay, 17));
            await logActivity(u.id, "lesson", "completed a recommended lesson", at(studyDay, 17));
          }
          const when = at(studyDay, 18);
          const p = await startAttempt(u.id, { mode: "practice", topicId: rec.topicId }, undefined, when);
          await submitAttempt(u.id, p.resultId, answer(st, p.questions.map((q) => q.id), st.growth * (r + 1)), new Date(when.getTime() + 6 * 60_000));
        }
      }
    }
    // Recent practice so streaks and daily activity look alive.
    const recentDays = st.growth > 0 ? [3, 2, 1] : [5];
    for (const d of recentDays) {
      // Aarav practises English and Science only, so his maths gaps stay open for the live demo.
      const pool = st.email === "aarav@edugap.demo" ? ["tenses", "punctuation", "electricity"] : Object.keys(st.overrides).length ? Object.keys(st.overrides) : ["fractions", "cells", "tenses"];
      const slug = pool[Math.floor(rand() * pool.length)];
      const when = at(d, 16);
      const p = await startAttempt(u.id, { mode: "practice", topicId: topicBySlug.get(slug)!.id }, undefined, when);
      await submitAttempt(u.id, p.resultId, answer(st, p.questions.map((q) => q.id), st.growth * 2.5), new Date(when.getTime() + 5 * 60_000));
    }
  }

  // ---- teacher-assigned assessments
  const assign = async (title: string, classId: number, teacherId: number, slugs: string[], dueInDays: number, createdDaysAgo: number) => {
    const ids = slugs.map((s) => topicBySlug.get(s)!.id);
    const qs = await db().select({ id: questions.id, topicId: questions.topicId, difficulty: questions.difficulty }).from(questions).where(sql`${questions.topicId} in (${sql.join(ids.map((x) => sql`${x}`), sql`, `)})`);
    // One question per difficulty level per topic, easiest first.
    const picked = ids.flatMap((tid) => ["easy", "medium", "hard"].flatMap((d) => qs.filter((q) => q.topicId === tid && q.difficulty === d).slice(0, 1).map((q) => q.id)));
    const [a] = await db()
      .insert(assessments)
      .values({ title, kind: "assigned", subjectId: topicBySlug.get(slugs[0])!.subjectId, topicIds: ids, questionCount: picked.length, classId, createdBy: teacherId, dueAt: new Date(now + dueInDays * day), createdAt: new Date(now - createdDaysAgo * day) })
      .returning();
    await db().insert(assessmentQuestions).values(picked.map((questionId, position) => ({ assessmentId: a.id, questionId, position })));
    await logActivity(teacherId, "assign", `assigned "${title}"`, new Date(now - createdDaysAgo * day));
    return { a, picked };
  };
  const mathCheck = await assign("Fractions & Percentages Check", cA.id, t1.id, ["fractions", "percentages"], 4, 3);
  const sciQuiz = await assign("Electricity & Forces Quiz", cB.id, t2.id, ["electricity", "force-motion"], 6, 2);

  // Some students have already completed their class assignment.
  const allStudents = await db().select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "student"));
  const takers: [string, typeof mathCheck][] = [
    ["diya@edugap.demo", mathCheck],
    ["kabir@edugap.demo", mathCheck],
    ["vihaan@edugap.demo", mathCheck],
    ["arjun@edugap.demo", sciQuiz],
    ["meera@edugap.demo", sciQuiz],
    ["saanvi@edugap.demo", sciQuiz],
    ["rohan@edugap.demo", sciQuiz],
  ];
  for (const [email, { a }] of takers) {
    const st = students.find((s) => s.email === email)!;
    const u = allStudents.find((x) => x.email === email)!;
    const when = at(1, 11);
    const attempt = await startAttempt(u.id, { mode: "assigned", assessmentId: a.id }, undefined, when);
    await submitAttempt(u.id, attempt.resultId, answer(st, attempt.questions.map((q) => q.id), st.growth * 2), new Date(when.getTime() + 10 * 60_000));
  }

  await logActivity(admin.id, "admin", "set up Grade 8-A and Grade 8-B", new Date(now - 36 * day));
  // Never print a custom password: hosting providers keep logs.
  const passwordNote = process.env.DEMO_PASSWORD ? "Demo password: the DEMO_PASSWORD you set" : `Demo password: ${DEMO_PASSWORD}`;
  console.log(`Seeded ${students.length} students, 2 teachers, 1 admin, ${curriculum.length} subjects. ${passwordNote}`);
}

// `npm run seed` resets and reseeds.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    // The embedded database is single-process: reseeding under a running server corrupts it.
    if (!process.env.DATABASE_URL) {
      const port = process.env.API_PORT ?? 4000;
      const running = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(800) }).then(() => true, () => false);
      if (running) {
        console.error(`The EduGap server is running on port ${port}. Stop it (Ctrl+C) before reseeding the embedded database.`);
        process.exit(1);
      }
    }
    await seed({ reset: true });
  })()
    .then(() => closeDb())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
