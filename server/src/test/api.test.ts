import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { createApp } from "../app.js";
import { initDb, closeDb, db, schema } from "../db/index.js";
import { seed, DEMO_PASSWORD } from "../db/seed.js";

const app = createApp();
const H = { "X-Requested-With": "edugap" };

async function login(email: string, password = DEMO_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").set(H).send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return agent;
}

async function answerKey(questionIds: number[]) {
  const rows = await db().select({ id: schema.questions.id, correctIndex: schema.questions.correctIndex, topicId: schema.questions.topicId, options: schema.questions.options }).from(schema.questions).where(inArray(schema.questions.id, questionIds));
  return new Map(rows.map((r) => [r.id, r]));
}

beforeAll(async () => {
  await initDb();
  await seed({ reset: true });
});
afterAll(async () => {
  await closeDb();
});

describe("authentication", () => {
  it("rejects a wrong password with a generic message", async () => {
    const res = await request(app).post("/api/auth/login").set(H).send({ email: "aarav@edugap.demo", password: "wrong-pass1" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Incorrect email or password");
  });

  it("rejects state-changing requests without the CSRF header", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "aarav@edugap.demo", password: DEMO_PASSWORD });
    expect(res.status).toBe(403);
  });

  it("validates registration and returns field errors", async () => {
    const res = await request(app).post("/api/auth/register").set(H).send({ role: "student", name: "A", email: "nope", password: "short", grade: 8 });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("registers a student, sets an httpOnly cookie, and blocks duplicate emails", async () => {
    const agent = request.agent(app);
    const body = { role: "student", name: "Test Student", email: "Test.Student@Example.com", password: "Passw0rd!", grade: 8, classId: 1 };
    const res = await agent.post("/api/auth/register").set(H).send(body);
    expect(res.status).toBe(201);
    expect(String(res.headers["set-cookie"])).toMatch(/HttpOnly/i);
    const me = await agent.get("/api/auth/me");
    expect(me.body.user).toMatchObject({ email: "test.student@example.com", role: "student" });
    const dupe = await request(app).post("/api/auth/register").set(H).send(body);
    expect(dupe.status).toBe(409);
  });

  it("self-registered teachers need admin approval before they can sign in or read the answer key", async () => {
    const agent = request.agent(app);
    const reg = await agent.post("/api/auth/register").set(H).send({ role: "teacher", name: "New Teacher", email: "new.teacher@example.com", password: "Passw0rd!", department: "Maths" });
    expect(reg.status).toBe(201);
    expect(reg.body).toEqual({ pending: true });
    expect(reg.headers["set-cookie"]).toBeUndefined();
    expect((await agent.get("/api/teacher/questions?topicIds=1")).status).toBe(401);
    const blocked = await request(app).post("/api/auth/login").set(H).send({ email: "new.teacher@example.com", password: "Passw0rd!" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toMatch(/approval/);

    const admin = await login("admin@edugap.demo");
    const [t] = await db().select().from(schema.users).where(eq(schema.users.email, "new.teacher@example.com"));
    expect((await admin.patch(`/api/admin/users/${t.id}`).set(H).send({ isActive: true })).status).toBe(200);
    const teacher = await login("new.teacher@example.com", "Passw0rd!");
    // Approved but no class yet: sees no students.
    expect((await teacher.get("/api/teacher/students")).body).toEqual([]);
  });

  it("changing a password signs out other sessions but keeps the current one", async () => {
    await request(app).post("/api/auth/register").set(H).send({ role: "student", name: "Two Devices", email: "two@example.com", password: "Passw0rd!", grade: 8 });
    const phone = await login("two@example.com", "Passw0rd!");
    const laptop = await login("two@example.com", "Passw0rd!");
    const res = await laptop.post("/api/profile/password").set(H).send({ currentPassword: "Passw0rd!", newPassword: "N3wPassword!" });
    expect(res.status).toBe(200);
    expect((await laptop.get("/api/auth/me")).body.user?.email).toBe("two@example.com");
    expect((await phone.get("/api/auth/me")).body.user).toBeNull();
  });

  it("cannot self-register as admin", async () => {
    const res = await request(app).post("/api/auth/register").set(H).send({ role: "admin", name: "Evil", email: "evil@x.com", password: "Passw0rd!" });
    expect(res.status).toBe(400);
  });

  it("requires sign-in for protected routes", async () => {
    expect((await request(app).get("/api/student/dashboard")).status).toBe(401);
    expect((await request(app).get("/api/auth/me")).body).toEqual({ user: null });
  });
});

describe("role-based access", () => {
  it("students cannot open teacher or admin APIs", async () => {
    const s = await login("aarav@edugap.demo");
    expect((await s.get("/api/teacher/overview")).status).toBe(403);
    expect((await s.get("/api/admin/stats")).status).toBe(403);
  });
  it("teachers cannot open admin or student-only APIs", async () => {
    const t = await login("anita.sharma@edugap.demo");
    expect((await t.get("/api/admin/users")).status).toBe(403);
    expect((await t.get("/api/student/dashboard")).status).toBe(403);
  });
  it("teachers only see students in their own classes", async () => {
    const [aarav] = await db().select().from(schema.users).where(eq(schema.users.email, "aarav@edugap.demo"));
    const rahul = await login("rahul.verma@edugap.demo"); // teaches 8-B; Aarav is in 8-A
    expect((await rahul.get(`/api/teacher/students/${aarav.id}`)).status).toBe(404);
    const roster = await rahul.get("/api/teacher/students");
    expect(roster.body.some((s: { id: number }) => s.id === aarav.id)).toBe(false);
  });
});

describe("seeded demo data is derived from real answers", () => {
  it("Aarav has weak fractions with specific weak concepts", async () => {
    const s = await login("aarav@edugap.demo");
    const res = await s.get("/api/student/gaps");
    const fractions = res.body.find((g: { topicName: string }) => g.topicName === "Fractions");
    expect(fractions.status).not.toBe("strong");
    expect(fractions.weakConcepts.length).toBeGreaterThan(0);
    // Mastery must match what the stored answers say.
    const answers = await db().select().from(schema.studentAnswers).where(eq(schema.studentAnswers.topicId, fractions.topicId));
    expect(answers.length).toBeGreaterThan(0);
  });
});

describe("the end-to-end demo flow", () => {
  let student: ReturnType<typeof request.agent>;
  let mathId: number;
  let fractionsId: number;
  let fractionsBefore: number;

  beforeAll(async () => {
    student = await login("aarav@edugap.demo");
    const cat = await student.get("/api/catalog/subjects");
    const math = cat.body.find((s: { slug: string }) => s.slug === "mathematics");
    mathId = math.id;
    fractionsId = math.topics.find((t: { slug: string }) => t.slug === "fractions").id;
    const gaps = await student.get("/api/student/gaps");
    fractionsBefore = gaps.body.find((g: { topicId: number }) => g.topicId === fractionsId).mastery;
  });

  it("steps 2-5: takes a diagnostic, is graded on the server, gets gaps and recommendations", async () => {
    const start = await student.post("/api/student/attempts").set(H).send({ mode: "diagnostic", subjectId: mathId });
    expect(start.status).toBe(201);
    expect(start.body.questions).toHaveLength(10);
    // Answers are never sent to the browser.
    expect(JSON.stringify(start.body)).not.toMatch(/correctIndex|explanation/);

    const key = await answerKey(start.body.questions.map((q: { id: number }) => q.id));
    // Get every fractions question wrong and everything else right.
    const answers = start.body.questions.map((q: { id: number }) => {
      const k = key.get(q.id)!;
      return { questionId: q.id, selectedIndex: k.topicId === fractionsId ? (k.correctIndex + 1) % k.options.length : k.correctIndex };
    });
    const fractionCount = answers.filter((a: { questionId: number }) => key.get(a.questionId)!.topicId === fractionsId).length;
    expect(fractionCount).toBeGreaterThan(0);

    const res = await student.post(`/api/student/attempts/${start.body.resultId}/submit`).set(H).send({ answers });
    expect(res.status).toBe(200);
    expect(res.body.result.score).toBe(10 - fractionCount);
    expect(res.body.result.percent).toBeCloseTo(((10 - fractionCount) / 10) * 100, 1);
    expect(res.body.answers.every((a: { explanation: string }) => a.explanation.length > 0)).toBe(true);

    const frac = res.body.gaps.find((g: { topicId: number }) => g.topicId === fractionsId);
    expect(frac.mastery).toBeLessThan(fractionsBefore + 0.01);
    expect(frac.status).toBe("weak");
    expect(res.body.missedConcepts.every((m: { topicName: string }) => m.topicName === "Fractions")).toBe(true);
    const fracRecs = res.body.recommendations.filter((r: { topicId: number }) => r.topicId === fractionsId);
    expect(fracRecs.map((r: { type: string }) => r.type)).toEqual(expect.arrayContaining(["lesson", "practice"]));
    expect(fracRecs[0].reason).toMatch(/Fractions/);

    // Re-submitting the same attempt is rejected.
    const again = await student.post(`/api/student/attempts/${start.body.resultId}/submit`).set(H).send({ answers });
    expect(again.status).toBe(409);
  });

  it("step 6: studying the recommended lesson completes that recommendation", async () => {
    const recs = await student.get("/api/student/recommendations");
    const lessonRec = recs.body.pending.find((r: { topicId: number; type: string }) => r.topicId === fractionsId && r.type === "lesson");
    expect(lessonRec).toBeTruthy();
    const done = await student.post(`/api/student/lessons/${lessonRec.lessonId}/complete`).set(H).send();
    expect(done.status).toBe(200);
    const after = await student.get("/api/student/recommendations");
    expect(after.body.pending.some((r: { id: number }) => r.id === lessonRec.id)).toBe(false);
    expect(after.body.completed.some((r: { lessonId: number }) => r.lessonId === lessonRec.lessonId)).toBe(true);
    const practice = after.body.pending.find((r: { topicId: number; type: string }) => r.topicId === fractionsId && r.type === "practice");
    expect(practice.reason).toMatch(/studied the lesson/);
  });

  it("steps 7-8: a targeted practice shows improvement on the dashboard", async () => {
    const before = (await student.get("/api/student/gaps")).body.find((g: { topicId: number }) => g.topicId === fractionsId).mastery;
    for (let round = 0; round < 2; round++) {
      const start = await student.post("/api/student/attempts").set(H).send({ mode: "practice", topicId: fractionsId });
      expect(start.status).toBe(201);
      expect(start.body.source).toBe("rules"); // no API key in tests
      const key = await answerKey(start.body.questions.map((q: { id: number }) => q.id));
      const answers = start.body.questions.map((q: { id: number }) => ({ questionId: q.id, selectedIndex: key.get(q.id)!.correctIndex }));
      const res = await student.post(`/api/student/attempts/${start.body.resultId}/submit`).set(H).send({ answers });
      expect(res.body.result.percent).toBe(100);
    }
    const gaps = (await student.get("/api/student/gaps")).body;
    const frac = gaps.find((g: { topicId: number }) => g.topicId === fractionsId);
    expect(frac.mastery).toBeGreaterThan(before);
    expect(frac.previousMastery).not.toBeNull();
    const dash = await student.get("/api/student/dashboard");
    expect(dash.body.recentResults[0].percent).toBe(100);
    expect(dash.body.dailyGoals.find((g: { key: string }) => g.key === "assessment").current).toBe(1);
  });

  it("step 9: the teacher sees the updated performance", async () => {
    const [aarav] = await db().select().from(schema.users).where(eq(schema.users.email, "aarav@edugap.demo"));
    const teacher = await login("anita.sharma@edugap.demo");
    const detail = await teacher.get(`/api/teacher/students/${aarav.id}`);
    expect(detail.status).toBe(200);
    const studentGaps = (await student.get("/api/student/gaps")).body;
    const fracTeacher = detail.body.gaps.find((g: { topicId: number }) => g.topicId === fractionsId);
    expect(fracTeacher.mastery).toBe(studentGaps.find((g: { topicId: number }) => g.topicId === fractionsId).mastery);
    expect(detail.body.dashboard.recentResults[0].percent).toBe(100);
    const summary = await teacher.get(`/api/teacher/students/${aarav.id}/summary`);
    expect(summary.body.source).toBe("rules");
    expect(summary.body.summary.overview).toContain("Aarav");
  });
});

describe("attempt integrity", () => {
  it("one student cannot submit or view another student's attempt", async () => {
    const diya = await login("diya@edugap.demo");
    const cat = await diya.get("/api/catalog/subjects");
    const start = await diya.post("/api/student/attempts").set(H).send({ mode: "diagnostic", subjectId: cat.body[0].id });
    const kabir = await login("kabir@edugap.demo");
    expect((await kabir.post(`/api/student/attempts/${start.body.resultId}/submit`).set(H).send({ answers: [] })).status).toBe(404);
    expect((await kabir.get(`/api/student/attempts/${start.body.resultId}`)).status).toBe(404);
  });

  it("ignores answers to questions that were not served", async () => {
    const s = await login("meera@edugap.demo");
    const cat = await s.get("/api/catalog/subjects");
    const start = await s.post("/api/student/attempts").set(H).send({ mode: "diagnostic", subjectId: cat.body[1].id });
    const res = await s.post(`/api/student/attempts/${start.body.resultId}/submit`).set(H).send({ answers: [{ questionId: 999999, selectedIndex: 0 }] });
    expect(res.status).toBe(200);
    expect(res.body.result.score).toBe(0);
    expect(res.body.answers).toHaveLength(10);
  });
});

describe("teacher assessments", () => {
  it("creates an assessment for an own class, which the class can take, and shows results", async () => {
    const t = await login("anita.sharma@edugap.demo");
    const overview = await t.get("/api/teacher/overview");
    const classId = overview.body.classes[0].id;
    const cat = await t.get("/api/catalog/subjects");
    const sci = cat.body.find((s: { slug: string }) => s.slug === "science");
    const res = await t.post("/api/teacher/assessments").set(H).send({ title: "Cells check", classId, subjectId: sci.id, topicIds: [sci.topics[0].id], questionCount: 4, dueAt: new Date(Date.now() + 3 * 864e5).toISOString() });
    expect(res.status).toBe(201);

    const otherClass = await db().select().from(schema.classes).where(eq(schema.classes.name, "Grade 8-B"));
    const forbidden = await t.post("/api/teacher/assessments").set(H).send({ title: "Nope", classId: otherClass[0].id, subjectId: sci.id, topicIds: [sci.topics[0].id], questionCount: 4 });
    expect(forbidden.status).toBe(403);

    const s = await login("vihaan@edugap.demo");
    const list = await s.get("/api/student/assessments");
    expect(list.body.assigned.some((a: { id: number }) => a.id === res.body.id)).toBe(true);
    const start = await s.post("/api/student/attempts").set(H).send({ mode: "assigned", assessmentId: res.body.id });
    expect(start.body.questions).toHaveLength(4);
    await s.post(`/api/student/attempts/${start.body.resultId}/submit`).set(H).send({ answers: [] });

    const outsider = await login("meera@edugap.demo"); // 8-B
    expect((await outsider.post("/api/student/attempts").set(H).send({ mode: "assigned", assessmentId: res.body.id })).status).toBe(403);

    const results = await t.get(`/api/teacher/assessments/${res.body.id}/results`);
    expect(results.body.students.find((x: { name: string }) => x.name === "Vihaan Gupta").latest.percent).toBe(0);
    expect((await t.delete(`/api/teacher/assessments/${res.body.id}`).set(H)).status).toBe(409);
  });
});

describe("AI tutor (offline fallback)", () => {
  it("explains a matched topic using the lesson library", async () => {
    const s = await login("aarav@edugap.demo");
    const res = await s.post("/api/tutor/chat").set(H).send({ messages: [{ role: "user", content: "How do I add fractions with different denominators?" }], language: "en" });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("rules");
    expect(res.body.reply).toContain("Fractions");
    expect(res.body.reply).toMatch(/common denominator|denominators/i);
  });

  it("answers in the selected language", async () => {
    const s = await login("diya@edugap.demo");
    const res = await s.post("/api/tutor/chat").set(H).send({ messages: [{ role: "user", content: "explain ohm's law" }], language: "hi" });
    expect(res.body.reply).toContain("Electricity");
    expect(res.body.reply).toMatch(/[ऀ-ॿ]/); // Devanagari
  });

  it("validates input", async () => {
    const s = await login("diya@edugap.demo");
    expect((await s.post("/api/tutor/chat").set(H).send({ messages: [] })).status).toBe(400);
  });
});

describe("improvement report (fallback)", () => {
  it("builds focus areas from real gaps", async () => {
    const s = await login("kabir@edugap.demo");
    const res = await s.get("/api/student/report");
    expect(res.body.source).toBe("rules");
    expect(res.body.report.focusAreas.length).toBeGreaterThan(0);
    const weakest = res.body.gaps[0];
    expect(res.body.report.focusAreas[0].topic).toBe(weakest.topicName);
  });
});

describe("admin", () => {
  it("shows platform stats", async () => {
    const a = await login("admin@edugap.demo");
    const res = await a.get("/api/admin/stats");
    expect(res.body.users.student.total).toBeGreaterThanOrEqual(12);
    expect(res.body.users.teacher.total).toBeGreaterThanOrEqual(2);
    expect(res.body.aiMode).toBe("offline");
  });

  it("deactivating a user ends their access immediately", async () => {
    const victim = await login("priya@edugap.demo");
    const a = await login("admin@edugap.demo");
    const [priya] = await db().select().from(schema.users).where(eq(schema.users.email, "priya@edugap.demo"));
    expect((await a.patch(`/api/admin/users/${priya.id}`).set(H).send({ isActive: false })).status).toBe(200);
    expect((await victim.get("/api/student/dashboard")).status).toBe(401);
    const relogin = await request(app).post("/api/auth/login").set(H).send({ email: "priya@edugap.demo", password: DEMO_PASSWORD });
    expect(relogin.status).toBe(403);
    await a.patch(`/api/admin/users/${priya.id}`).set(H).send({ isActive: true });
  });

  it("an admin cannot demote themselves", async () => {
    const a = await login("admin@edugap.demo");
    const me = await a.get("/api/auth/me");
    expect((await a.patch(`/api/admin/users/${me.body.user.id}`).set(H).send({ role: "student" })).status).toBe(400);
  });

  it("validates new questions", async () => {
    const a = await login("admin@edugap.demo");
    const res = await a.post("/api/admin/questions").set(H).send({ topicId: 1, concept: "X", difficulty: "easy", prompt: "What?", options: ["a", "a"], correctIndex: 5, explanation: "Because" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(["correctIndex"]));
  });
});

describe("search engine files", () => {
  it("robots.txt allows public pages, blocks signed-in areas, and links the sitemap", async () => {
    const res = await request(app).get("/robots.txt").set("Host", "edugap.example.com");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Disallow: /student");
    expect(res.text).toContain("Disallow: /api/");
    expect(res.text).toContain("Sitemap: http://edugap.example.com/sitemap.xml");
  });

  it("sitemap.xml lists only public pages on the serving host", async () => {
    const res = await request(app).get("/sitemap.xml").set("Host", "edugap.example.com");
    expect(res.type).toMatch(/xml/);
    expect(res.text).toContain("<loc>http://edugap.example.com/</loc>");
    expect(res.text).toContain("<loc>http://edugap.example.com/register</loc>");
    expect(res.text).not.toMatch(/student|teacher|admin/);
  });

  it("injects a valid Google verification token and rejects anything that could be markup", async () => {
    const { renderIndexHtml } = await import("../app.js");
    const html = "<html><head><title>x</title></head><body></body></html>";
    expect(renderIndexHtml(html, "abcDEF123_-xyz789")).toContain('<meta name="google-site-verification" content="abcDEF123_-xyz789" />');
    expect(renderIndexHtml(html, '"><script>alert(1)</script>')).toBe(html);
    expect(renderIndexHtml(html, "")).toBe(html);
  });
});
