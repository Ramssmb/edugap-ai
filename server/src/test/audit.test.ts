/**
 * Functional audit: verifies behaviour against the database itself, not just API
 * responses. Mastery is recomputed here with an independent implementation of the
 * documented formula, so these tests don't simply re-run the engine against itself.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { createApp } from "../app.js";
import { initDb, closeDb, db, schema } from "../db/index.js";
import { seed, DEMO_PASSWORD } from "../db/seed.js";

const app = createApp();
const H = { "X-Requested-With": "edugap" };
type Agent = ReturnType<typeof request.agent>;

async function login(email: string, password = DEMO_PASSWORD): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").set(H).send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return agent;
}
const userId = async (email: string) => (await db().select().from(schema.users).where(eq(schema.users.email, email)))[0].id;

// ---- independent re-implementation of the documented mastery formula (README "How gap detection works")
type Row = { id: number; resultId: number; topicId: number; isCorrect: boolean; answeredAt: Date; difficulty: "easy" | "medium" | "hard"; concept: string };
const W = { easy: 1, medium: 1.5, hard: 2 };
function expectedMastery(rows: Row[]): number | null {
  const recent = [...rows].sort((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime() || b.id - a.id).slice(0, 8);
  if (!recent.length) return null;
  const ranks: number[] = [];
  recent.forEach((r) => !ranks.includes(r.resultId) && ranks.push(r.resultId));
  let earned = 0;
  let possible = 0;
  for (const r of recent) {
    const w = W[r.difficulty] * 0.85 ** ranks.indexOf(r.resultId);
    possible += w;
    if (r.isCorrect) earned += w;
  }
  return Math.round((earned / possible) * 1000) / 10;
}
const statusOf = (m: number) => (m >= 75 ? "strong" : m >= 50 ? "needs_improvement" : "weak");

async function answerRows(studentId: number, topicIds?: number[]): Promise<Row[]> {
  const { studentAnswers: a, questions: q } = schema;
  return db()
    .select({ id: a.id, resultId: a.resultId, topicId: a.topicId, isCorrect: a.isCorrect, answeredAt: a.answeredAt, difficulty: q.difficulty, concept: q.concept })
    .from(a)
    .innerJoin(q, eq(q.id, a.questionId))
    .where(topicIds ? and(eq(a.studentId, studentId), inArray(a.topicId, topicIds)) : eq(a.studentId, studentId));
}
async function gapRow(studentId: number, topicId: number) {
  const [g] = await db().select().from(schema.knowledgeGaps).where(and(eq(schema.knowledgeGaps.studentId, studentId), eq(schema.knowledgeGaps.topicId, topicId)));
  return g;
}

beforeAll(async () => {
  await initDb();
  await seed({ reset: true });
});
afterAll(async () => {
  await closeDb();
});

// =====================================================================================
describe("demo data is internally consistent and derived from real answers", () => {
  it("every completed attempt's stored score matches its stored answers", async () => {
    const results = await db().select().from(schema.assessmentResults).where(isNotNull(schema.assessmentResults.completedAt));
    const answers = await db().select().from(schema.studentAnswers);
    const qs = new Map((await db().select().from(schema.questions)).map((q) => [q.id, q]));
    expect(results.length).toBeGreaterThan(150);
    for (const r of results) {
      const mine = answers.filter((a) => a.resultId === r.id);
      expect(mine.length, `result ${r.id}`).toBe(r.questionIds.length);
      expect(r.total).toBe(r.questionIds.length);
      expect(r.score).toBe(mine.filter((a) => a.isCorrect).length);
      expect(r.percent).toBeCloseTo(Math.round((r.score! / r.total) * 1000) / 10, 5);
      expect(r.completedAt!.getTime()).toBeGreaterThanOrEqual(r.startedAt.getTime());
      expect(r.completedAt!.getTime()).toBeLessThanOrEqual(Date.now());
      expect(r.topicBreakdown!.reduce((n, t) => n + t.correct, 0)).toBe(r.score);
      expect(r.topicBreakdown!.reduce((n, t) => n + t.total, 0)).toBe(r.total);
      for (const a of mine) {
        const q = qs.get(a.questionId)!;
        expect(r.questionIds).toContain(a.questionId);
        expect(a.studentId).toBe(r.studentId);
        expect(a.topicId).toBe(q.topicId);
        expect(a.isCorrect).toBe(a.selectedIndex === q.correctIndex);
      }
    }
  });

  it("every knowledge gap equals an independent recomputation from the student's answers", async () => {
    const gaps = await db().select().from(schema.knowledgeGaps);
    const students = await db().select().from(schema.users).where(eq(schema.users.role, "student"));
    let checked = 0;
    for (const s of students) {
      const rows = await answerRows(s.id);
      const topics = [...new Set(rows.map((r) => r.topicId))];
      for (const t of topics) {
        const g = gaps.find((x) => x.studentId === s.id && x.topicId === t);
        expect(g, `gap row for student ${s.id} topic ${t}`).toBeTruthy();
        const m = expectedMastery(rows.filter((r) => r.topicId === t))!;
        expect(g!.mastery, `student ${s.id} topic ${t}`).toBeCloseTo(m, 5);
        expect(g!.status).toBe(statusOf(m));
        // Every weak concept was actually answered wrongly within the window.
        for (const c of g!.weakConcepts) expect(rows.some((r) => r.topicId === t && r.concept === c.concept && !r.isCorrect)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(12 * 12);
  });

  it("pending recommendations exist only for non-strong topics, without duplicates", async () => {
    const recs = await db().select().from(schema.recommendations).where(eq(schema.recommendations.status, "pending"));
    const gaps = await db().select().from(schema.knowledgeGaps);
    expect(recs.length).toBeGreaterThan(0);
    const keys = new Set<string>();
    for (const r of recs) {
      const g = gaps.find((x) => x.studentId === r.studentId && x.topicId === r.topicId);
      expect(g, `rec ${r.id} has a gap`).toBeTruthy();
      expect(g!.status).not.toBe("strong");
      const k = `${r.studentId}:${r.topicId}:${r.type}`;
      expect(keys.has(k), `duplicate ${k}`).toBe(false);
      keys.add(k);
      if (r.type === "lesson") expect(r.lessonId).not.toBeNull();
    }
    // Conversely, every weak topic has at least a practice recommendation.
    for (const g of gaps.filter((x) => x.status === "weak")) expect(recs.some((r) => r.studentId === g.studentId && r.topicId === g.topicId)).toBe(true);
  });

  it("assigned attempts were only taken by students in the assigned class", async () => {
    const rows = await db()
      .select({ classId: schema.assessments.classId, studentClass: schema.studentProfiles.classId })
      .from(schema.assessmentResults)
      .innerJoin(schema.assessments, eq(schema.assessments.id, schema.assessmentResults.assessmentId))
      .innerJoin(schema.studentProfiles, eq(schema.studentProfiles.userId, schema.assessmentResults.studentId))
      .where(eq(schema.assessments.kind, "assigned"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.studentClass).toBe(r.classId);
  });

  it("is realistic: 12 students across 3 subjects with a spread of performance levels", async () => {
    const students = await db().select().from(schema.users).where(eq(schema.users.role, "student"));
    expect(students).toHaveLength(12);
    const masteries: number[] = [];
    for (const s of students) {
      const g = await db().select({ m: schema.knowledgeGaps.mastery, subjectId: schema.topics.subjectId }).from(schema.knowledgeGaps).innerJoin(schema.topics, eq(schema.topics.id, schema.knowledgeGaps.topicId)).where(eq(schema.knowledgeGaps.studentId, s.id));
      expect(new Set(g.map((x) => x.subjectId)).size, `${s.email} covers all subjects`).toBe(3);
      masteries.push(g.reduce((n, x) => n + x.m, 0) / g.length);
    }
    expect(Math.min(...masteries)).toBeLessThan(50); // a struggling student
    expect(Math.max(...masteries)).toBeGreaterThan(75); // a strong student
    const statuses = await db().select({ s: schema.knowledgeGaps.status }).from(schema.knowledgeGaps);
    for (const s of ["strong", "needs_improvement", "weak"]) expect(statuses.filter((x) => x.s === s).length).toBeGreaterThan(10);
    const records = await db().select().from(schema.progressRecords);
    for (const p of records) expect(p.mastery).toBeGreaterThanOrEqual(0), expect(p.mastery).toBeLessThanOrEqual(100);
  });
});

// =====================================================================================
describe("critical workflow, verified against stored records", () => {
  const email = "audit.student@example.com";
  let s: Agent;
  let sid: number;
  let mathId: number;
  let fractionsId: number;
  let fractionsLessonId: number;
  let firstFractionsMastery: number;

  beforeAll(async () => {
    // A fresh student in Grade 8-A (Anita's class) so every record comes from this test.
    const classA = (await db().select().from(schema.classes).where(eq(schema.classes.name, "Grade 8-A")))[0];
    const reg = await request(app).post("/api/auth/register").set(H).send({ role: "student", name: "Audit Student", email, password: "Passw0rd!", grade: 8, classId: classA.id });
    expect(reg.status).toBe(201);
    sid = await userId(email);
    const math = (await db().select().from(schema.subjects).where(eq(schema.subjects.slug, "mathematics")))[0];
    mathId = math.id;
    fractionsId = (await db().select().from(schema.topics).where(and(eq(schema.topics.subjectId, mathId), eq(schema.topics.slug, "fractions"))))[0].id;
    fractionsLessonId = (await db().select().from(schema.lessons).where(eq(schema.lessons.topicId, fractionsId)))[0].id;
  });

  it("1. the student logs in and starts with no data", async () => {
    s = await login(email, "Passw0rd!");
    const dash = await s.get("/api/student/dashboard");
    expect(dash.status).toBe(200);
    expect(dash.body.stats).toMatchObject({ assessmentsCompleted: 0, lessonsCompleted: 0, overallMastery: null, topicsAssessed: 0 });
  });

  it("2-4. takes a diagnostic; it is graded on the server and saved to the database", async () => {
    const start = await s.post("/api/student/attempts").set(H).send({ mode: "diagnostic", subjectId: mathId });
    expect(start.status).toBe(201);
    const [open] = await db().select().from(schema.assessmentResults).where(eq(schema.assessmentResults.id, start.body.resultId));
    expect(open).toMatchObject({ studentId: sid, completedAt: null, score: null });
    expect(open.questionIds).toEqual(start.body.questions.map((q: { id: number }) => q.id));
    expect(JSON.stringify(start.body)).not.toMatch(/correctIndex|explanation/);

    const qs = await db().select().from(schema.questions).where(inArray(schema.questions.id, open.questionIds));
    // Wrong on every fractions question, right on everything else.
    const answers = open.questionIds.map((id) => {
      const q = qs.find((x) => x.id === id)!;
      return { questionId: id, selectedIndex: q.topicId === fractionsId ? (q.correctIndex + 1) % q.options.length : q.correctIndex };
    });
    const wrong = qs.filter((q) => q.topicId === fractionsId).length;
    expect(wrong).toBeGreaterThan(0);
    const res = await s.post(`/api/student/attempts/${start.body.resultId}/submit`).set(H).send({ answers });
    expect(res.status).toBe(200);

    const [saved] = await db().select().from(schema.assessmentResults).where(eq(schema.assessmentResults.id, start.body.resultId));
    expect(saved.score).toBe(10 - wrong);
    expect(saved.percent).toBeCloseTo(((10 - wrong) / 10) * 100, 5);
    expect(saved.completedAt).not.toBeNull();
    const stored = await db().select().from(schema.studentAnswers).where(eq(schema.studentAnswers.resultId, saved.id));
    expect(stored).toHaveLength(10);
    for (const a of stored) expect(a.isCorrect).toBe(a.topicId !== fractionsId);
    expect(res.body.result.score).toBe(saved.score);
  });

  it("5. knowledge gaps come from the actual answers", async () => {
    const rows = await answerRows(sid);
    for (const t of [...new Set(rows.map((r) => r.topicId))]) {
      const g = await gapRow(sid, t);
      expect(g.mastery).toBeCloseTo(expectedMastery(rows.filter((r) => r.topicId === t))!, 5);
    }
    const frac = await gapRow(sid, fractionsId);
    expect(frac.mastery).toBe(0);
    expect(frac.status).toBe("weak");
    const missedConcepts = new Set(rows.filter((r) => r.topicId === fractionsId).map((r) => r.concept));
    expect(new Set(frac.weakConcepts.map((c) => c.concept))).toEqual(missedConcepts);
    firstFractionsMastery = frac.mastery;
  });

  it("6. recommendations target exactly the weak topics, citing the missed concepts", async () => {
    const recs = await db().select().from(schema.recommendations).where(and(eq(schema.recommendations.studentId, sid), eq(schema.recommendations.status, "pending")));
    const gaps = await db().select().from(schema.knowledgeGaps).where(eq(schema.knowledgeGaps.studentId, sid));
    const nonStrong = gaps.filter((g) => g.status !== "strong").map((g) => g.topicId).sort();
    expect([...new Set(recs.map((r) => r.topicId))].sort()).toEqual(nonStrong);
    const fracRecs = recs.filter((r) => r.topicId === fractionsId);
    expect(fracRecs.map((r) => r.type).sort()).toEqual(["lesson", "practice"]);
    const frac = await gapRow(sid, fractionsId);
    expect(frac.weakConcepts.some((c) => fracRecs[0].reason.includes(c.concept))).toBe(true);
    // Weakest topic is first in the plan.
    const api = await s.get("/api/student/recommendations");
    expect(api.body.pending[0].topicId).toBe(fractionsId);
  });

  it("7. completing the recommended lesson is recorded and resolves the recommendation", async () => {
    const res = await s.post(`/api/student/lessons/${fractionsLessonId}/complete`).set(H).send({});
    expect(res.status).toBe(200);
    const [progress] = await db().select().from(schema.lessonProgress).where(and(eq(schema.lessonProgress.studentId, sid), eq(schema.lessonProgress.lessonId, fractionsLessonId)));
    expect(progress).toBeTruthy();
    const recs = await db().select().from(schema.recommendations).where(and(eq(schema.recommendations.studentId, sid), eq(schema.recommendations.topicId, fractionsId)));
    expect(recs.find((r) => r.type === "lesson" && r.status === "completed")?.completedAt).toBeTruthy();
    expect(recs.some((r) => r.type === "lesson" && r.status === "pending")).toBe(false);
    expect(recs.find((r) => r.type === "practice" && r.status === "pending")?.reason).toMatch(/studied the lesson/);
  });

  it("8-9. another assessment raises mastery by exactly the recomputed amount", async () => {
    const before = (await gapRow(sid, fractionsId)).mastery;
    const start = await s.post("/api/student/attempts").set(H).send({ mode: "practice", topicId: fractionsId });
    expect(start.status).toBe(201);
    const qs = await db().select().from(schema.questions).where(inArray(schema.questions.id, start.body.questions.map((q: { id: number }) => q.id)));
    expect(qs.every((q) => q.topicId === fractionsId)).toBe(true);
    const res = await s
      .post(`/api/student/attempts/${start.body.resultId}/submit`)
      .set(H)
      .send({ answers: qs.map((q) => ({ questionId: q.id, selectedIndex: q.correctIndex })) });
    expect(res.body.result.percent).toBe(100);

    const after = await gapRow(sid, fractionsId);
    const expected = expectedMastery(await answerRows(sid, [fractionsId]))!;
    expect(after.mastery).toBeCloseTo(expected, 5);
    expect(after.mastery).toBeGreaterThan(before);
    expect(after.previousMastery).toBe(before);
    // The "before → after" shown to the student matches the stored values.
    expect(res.body.before.find((b: { topicId: number }) => b.topicId === fractionsId).mastery).toBe(before);
    expect(res.body.gaps.find((g: { topicId: number }) => g.topicId === fractionsId).mastery).toBe(after.mastery);

    // Dashboard and progress figures come from the same records.
    const gaps = await db().select().from(schema.knowledgeGaps).where(eq(schema.knowledgeGaps.studentId, sid));
    const dash = (await s.get("/api/student/dashboard")).body;
    expect(dash.stats.overallMastery).toBeCloseTo(Math.round((gaps.reduce((n, g) => n + g.mastery, 0) / gaps.length) * 10) / 10, 5);
    expect(dash.stats.assessmentsCompleted).toBe(2);
    expect(dash.stats.lessonsCompleted).toBe(1);
    expect(dash.stats.topicsAssessed).toBe(gaps.length);
    expect(dash.topics.weak.length + dash.topics.needsImprovement.length + dash.topics.strong.length).toBe(gaps.length);
    const progress = (await s.get("/api/student/progress")).body;
    const cmp = progress.comparison.find((c: { topicId: number }) => c.topicId === fractionsId);
    expect(cmp.then).toBe(Math.round(firstFractionsMastery));
    expect(cmp.now).toBe(Math.round(after.mastery));
  });

  it("10. the class teacher sees the updated performance; another teacher cannot", async () => {
    const anita = await login("anita.sharma@edugap.demo");
    const gaps = await db().select().from(schema.knowledgeGaps).where(eq(schema.knowledgeGaps.studentId, sid));
    const avg = Math.round((gaps.reduce((n, g) => n + g.mastery, 0) / gaps.length) * 10) / 10;
    const roster = (await anita.get("/api/teacher/students")).body;
    const me = roster.find((r: { id: number }) => r.id === sid);
    expect(me.mastery).toBeCloseTo(avg, 5);
    expect(me.assessments).toBe(2);
    const detail = (await anita.get(`/api/teacher/students/${sid}`)).body;
    expect(detail.gaps.find((g: { topicId: number }) => g.topicId === fractionsId).mastery).toBe((await gapRow(sid, fractionsId)).mastery);
    // Classroom average is the mean of the roster's real masteries.
    const overview = (await anita.get("/api/teacher/overview")).body;
    const ms = roster.filter((r: { mastery: number | null }) => r.mastery !== null).map((r: { mastery: number }) => r.mastery);
    expect(overview.stats.classAverage).toBeCloseTo(Math.round((ms.reduce((n: number, m: number) => n + m, 0) / ms.length) * 10) / 10, 5);
    expect(overview.stats.students).toBe(roster.length);

    const rahul = await login("rahul.verma@edugap.demo");
    expect((await rahul.get(`/api/teacher/students/${sid}`)).status).toBe(404);
    expect((await rahul.get(`/api/teacher/students/${sid}/summary`)).status).toBe(404);
  });
});

// =====================================================================================
describe("backend permissions on every route", () => {
  let student: Agent, otherStudent: Agent, teacherA: Agent, teacherB: Agent, admin: Agent;
  let aaravResult: number, aaravRec: number, aaravId: number, assignedA: number;

  beforeAll(async () => {
    [student, otherStudent, teacherA, teacherB, admin] = await Promise.all([
      login("aarav@edugap.demo"),
      login("meera@edugap.demo"),
      login("anita.sharma@edugap.demo"),
      login("rahul.verma@edugap.demo"),
      login("admin@edugap.demo"),
    ]);
    aaravId = await userId("aarav@edugap.demo");
    aaravResult = (await db().select().from(schema.assessmentResults).where(and(eq(schema.assessmentResults.studentId, aaravId), isNotNull(schema.assessmentResults.completedAt))))[0].id;
    aaravRec = (await db().select().from(schema.recommendations).where(and(eq(schema.recommendations.studentId, aaravId), eq(schema.recommendations.status, "pending"))))[0].id;
    const classA = (await db().select().from(schema.classes).where(eq(schema.classes.name, "Grade 8-A")))[0];
    assignedA = (await db().select().from(schema.assessments).where(and(eq(schema.assessments.kind, "assigned"), eq(schema.assessments.classId, classA.id))))[0].id;
  });

  const studentRoutes: [string, string, object?][] = [
    ["get", "/api/student/dashboard"], ["get", "/api/student/progress"], ["get", "/api/student/gaps"], ["get", "/api/student/report"],
    ["get", "/api/student/recommendations"], ["post", "/api/student/recommendations/1/dismiss", {}], ["post", "/api/student/lessons/1/complete", {}],
    ["get", "/api/student/assessments"], ["get", "/api/student/results"], ["get", "/api/student/results/1"],
    ["post", "/api/student/attempts", { mode: "diagnostic", subjectId: 1 }], ["get", "/api/student/attempts/1"], ["post", "/api/student/attempts/1/submit", { answers: [] }],
    ["get", "/api/tutor/status"], ["post", "/api/tutor/chat", { messages: [{ role: "user", content: "hi" }] }],
  ];
  const teacherRoutes: [string, string, object?][] = [
    ["get", "/api/teacher/overview"], ["get", "/api/teacher/students"], ["get", "/api/teacher/students/1"], ["get", "/api/teacher/students/1/summary"],
    ["get", "/api/teacher/questions?topicIds=1"], ["get", "/api/teacher/assessments"], ["post", "/api/teacher/assessments", {}],
    ["get", "/api/teacher/assessments/1/results"], ["get", "/api/teacher/results/1"], ["delete", "/api/teacher/assessments/999999"],
  ];
  const adminRoutes: [string, string, object?][] = [
    ["get", "/api/admin/stats"], ["get", "/api/admin/activity"], ["get", "/api/admin/users"], ["post", "/api/admin/users", {}], ["patch", "/api/admin/users/1", {}],
    ["get", "/api/admin/classes"], ["post", "/api/admin/classes", {}], ["patch", "/api/admin/classes/1", {}],
    ["post", "/api/admin/subjects", {}], ["patch", "/api/admin/subjects/1", {}], ["delete", "/api/admin/subjects/999999"],
    ["post", "/api/admin/topics", {}], ["patch", "/api/admin/topics/1", {}], ["delete", "/api/admin/topics/999999"],
    ["get", "/api/admin/lessons/1"], ["post", "/api/admin/lessons", {}], ["patch", "/api/admin/lessons/1", {}], ["delete", "/api/admin/lessons/999999"],
    ["get", "/api/admin/questions?topicId=1"], ["post", "/api/admin/questions", {}], ["delete", "/api/admin/questions/999999"],
  ];
  const sharedRoutes: [string, string, object?][] = [["get", "/api/catalog/subjects"], ["get", "/api/catalog/lessons"], ["get", "/api/catalog/lessons/1"], ["get", "/api/profile"], ["patch", "/api/profile", {}], ["post", "/api/profile/password", {}]];

  const call = (agent: Agent | ReturnType<typeof request>, [method, path, body]: [string, string, object?]) => {
    const r = (agent as unknown as Record<string, (p: string) => request.Test>)[method](path).set(H);
    return body ? r.send(body) : r;
  };

  it("anonymous users get 401 on every protected route", async () => {
    for (const route of [...studentRoutes, ...teacherRoutes, ...adminRoutes, ...sharedRoutes]) {
      expect((await call(request(app), route)).status, route.join(" ")).toBe(401);
    }
  });

  it("students get 403 on every teacher and admin route", async () => {
    for (const route of [...teacherRoutes, ...adminRoutes]) expect((await call(student, route)).status, route.join(" ")).toBe(403);
  });

  it("teachers get 403 on every student, tutor and admin route", async () => {
    for (const route of [...studentRoutes, ...adminRoutes]) expect((await call(teacherA, route)).status, route.join(" ")).toBe(403);
  });

  it("admins are not students: 403 on student and tutor routes", async () => {
    for (const route of studentRoutes) expect((await call(admin, route)).status, route.join(" ")).toBe(403);
  });

  it("every state-changing route rejects requests without the CSRF header", async () => {
    const mutating = [...studentRoutes, ...teacherRoutes, ...adminRoutes, ...sharedRoutes].filter(([m]) => m !== "get");
    for (const [method, path, body] of mutating) {
      const r = (admin as unknown as Record<string, (p: string) => request.Test>)[method](path);
      expect((await (body ? r.send(body) : r)).status, `${method} ${path}`).toBe(403);
    }
  });

  it("a student cannot touch another student's records", async () => {
    expect((await otherStudent.get(`/api/student/results/${aaravResult}`)).status).toBe(404);
    expect((await otherStudent.post(`/api/student/recommendations/${aaravRec}/dismiss`).set(H).send({})).status).toBe(404);
    const [rec] = await db().select().from(schema.recommendations).where(eq(schema.recommendations.id, aaravRec));
    expect(rec.status).toBe("pending");
  });

  it("a teacher cannot read another class's students, results or assessments", async () => {
    expect((await teacherB.get(`/api/teacher/students/${aaravId}`)).status).toBe(404);
    expect((await teacherB.get(`/api/teacher/students/${aaravId}/summary`)).status).toBe(404);
    expect((await teacherB.get(`/api/teacher/results/${aaravResult}`)).status).toBe(404);
    expect((await teacherB.get(`/api/teacher/assessments/${assignedA}/results`)).status).toBe(404);
    expect((await teacherB.delete(`/api/teacher/assessments/${assignedA}`).set(H)).status).toBe(404);
    expect((await teacherB.get("/api/teacher/assessments")).body.some((a: { id: number }) => a.id === assignedA)).toBe(false);
    // ...while the class teacher can.
    expect((await teacherA.get(`/api/teacher/results/${aaravResult}`)).status).toBe(200);
  });
});

// =====================================================================================
describe("admin statistics come from the database", () => {
  it("counts and averages match direct aggregates", async () => {
    const a = await login("admin@edugap.demo");
    const s = (await a.get("/api/admin/stats")).body;
    const users = await db().select().from(schema.users);
    expect(s.users.student.total).toBe(users.filter((u) => u.role === "student").length);
    expect(s.users.teacher.total).toBe(users.filter((u) => u.role === "teacher").length);
    const completed = await db().select().from(schema.assessmentResults).where(isNotNull(schema.assessmentResults.completedAt));
    expect(s.assessments.total).toBe(completed.length);
    const gaps = await db().select().from(schema.knowledgeGaps);
    expect(s.platformMastery).toBeCloseTo(Math.round((gaps.reduce((n, g) => n + g.mastery, 0) / gaps.length) * 10) / 10, 5);
    expect(s.answers).toBe((await db().select().from(schema.studentAnswers)).length);
    expect(s.statusMix.reduce((n: number, x: { count: number }) => n + x.count, 0)).toBe(gaps.length);
    expect(s.daily.reduce((n: number, d: { assessments: number }) => n + d.assessments, 0)).toBeLessThanOrEqual(completed.length);
  });
});
