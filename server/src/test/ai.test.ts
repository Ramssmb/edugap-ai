/**
 * AI integration, tested against a local stand-in for the Anthropic Messages API.
 * This exercises the real SDK and our request/response handling end to end
 * (what we send, how we parse it, how failures fall back). It does not judge the
 * quality of real Claude output — that needs a real API key.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { eq, and } from "drizzle-orm";

type Captured = { url: string; headers: http.IncomingHttpHeaders; body: Record<string, unknown> };
let captured: Captured[] = [];
let reply: (body: Record<string, unknown>) => { status?: number; json: unknown } = () => ({ json: {} });

const message = (text: string, stop_reason = "end_turn") => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

const fake = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    captured.push({ url: req.url ?? "", headers: req.headers, body });
    const r = reply(body);
    res.writeHead(r.status ?? 200, { "content-type": "application/json", "request-id": "req_test" });
    res.end(JSON.stringify(r.json));
  });
});

// Imported after the fake server is up so the SDK client picks up the base URL.
let app: import("express").Express;
let mod: { db: typeof import("../db/index.js").db; schema: typeof import("../db/index.js").schema; closeDb: () => Promise<void> };
const H = { "X-Requested-With": "edugap" };

beforeAll(async () => {
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  const { config } = await import("../config.js");
  config.anthropicApiKey = "sk-ant-test-key"; // test mode normally forces offline
  const dbm = await import("../db/index.js");
  await dbm.initDb();
  await (await import("../db/seed.js")).seed({ reset: true });
  app = (await import("../app.js")).createApp();
  mod = { db: dbm.db, schema: dbm.schema, closeDb: dbm.closeDb };
});
afterAll(async () => {
  await mod.closeDb();
  await new Promise((r) => fake.close(r));
});
beforeEach(() => {
  captured = [];
});

async function login(email: string) {
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").set(H).send({ email, password: "EduGap@2026" })).status).toBe(200);
  return agent;
}

describe("AI integration (stand-in API)", () => {
  it("health reports AI enabled when a key is configured", async () => {
    expect((await request(app).get("/api/health")).body.ai).toBe("enabled");
  });

  it("tutor: sends a correct request and returns Claude's reply", async () => {
    reply = () => ({ json: message("**Fractions** are parts of a whole. Step 1: …") });
    const s = await login("diya@edugap.demo");
    const res = await s.post("/api/tutor/chat").set(H).send({ messages: [{ role: "user", content: "What is a fraction?" }], language: "hi" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "**Fractions** are parts of a whole. Step 1: …", source: "ai" });

    const req = captured[0];
    expect(req.url).toMatch(/^\/v1\/messages/);
    // SDK 1.x sends the key as a bearer token (older versions used x-api-key).
    expect(req.headers.authorization ?? `Bearer ${req.headers["x-api-key"]}`).toBe("Bearer sk-ant-test-key");
    expect(String(req.headers["anthropic-beta"])).toContain("server-side-fallback-2026-07-01");
    expect(req.body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "low" } });
    expect(req.body.messages).toEqual([{ role: "user", content: "What is a fraction?" }]);
    // The system prompt carries the language, grade and the student's real gap data.
    const system = String(req.body.system);
    expect(system).toContain("Reply in Hindi");
    expect(system).toContain("Grade 8");
    expect(system).toMatch(/% mastery/);
    // The key never reaches the browser.
    expect(JSON.stringify(res.body)).not.toContain("sk-ant");
  });

  it("tutor: a refusal or API error falls back to the offline tutor", async () => {
    const s = await login("diya@edugap.demo");
    reply = () => ({ json: message("", "refusal") });
    const refused = await s.post("/api/tutor/chat").set(H).send({ messages: [{ role: "user", content: "explain ohm's law" }], language: "en" });
    expect(refused.body.source).toBe("rules");
    expect(refused.body.reply).toContain("Electricity");

    reply = () => ({ status: 500, json: { type: "error", error: { type: "api_error", message: "boom" } } });
    const failed = await s.post("/api/tutor/chat").set(H).send({ messages: [{ role: "user", content: "explain ohm's law" }], language: "en" });
    expect(failed.status).toBe(200);
    expect(failed.body.source).toBe("rules");
  });

  it("improvement report: structured output is requested, parsed and served", async () => {
    const report = {
      headline: "You're improving fast, Kabir.",
      summary: "Your algebra needs work.",
      strengths: ["Matter & Its Changes"],
      focusAreas: [{ topic: "Linear Equations", concept: "Equations with brackets", whyItMatters: "Used everywhere", action: "Study the lesson" }],
      weeklyPlan: [{ day: "Monday", task: "Lesson" }],
    };
    reply = () => ({ json: message(JSON.stringify(report)) });
    const s = await login("kabir@edugap.demo");
    const res = await s.get("/api/student/report");
    expect(res.body.source).toBe("ai");
    expect(res.body.report).toEqual(report);
    const req = captured[0];
    expect((req.body.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    // The prompt is built from this student's stored gaps.
    expect(JSON.stringify(req.body.messages)).toMatch(/Linear Equations: \d+% mastery/);
  });

  it("practice: valid AI questions are saved and served; invalid ones fall back to the bank", async () => {
    const s = await login("aarav@edugap.demo");
    const [fractions] = await mod.db().select().from(mod.schema.topics).where(eq(mod.schema.topics.slug, "fractions"));
    const q = (prompt: string, options: string[], correctIndex: number, concept = "Dividing fractions") => ({ concept, difficulty: "easy", prompt, options, correctIndex, explanation: "Because." });

    reply = () => ({
      json: message(
        JSON.stringify({
          questions: [
            q("What is 1/2 ÷ 1/4?", ["2", "1/8", "1/2", "4"], 0),
            q("What is 2/3 ÷ 1/3?", ["2/9", "2", "1", "6"], 1),
            q("What is 3/4 ÷ 1/2?", ["3/8", "1 1/2", "2/3", "6"], 1),
            q("Bad: duplicate options", ["1", "1", "2", "3"], 0), // rejected: options not distinct
            q("Bad: unknown concept", ["a", "b", "c", "d"], 0, "Made-up concept"), // rejected
          ],
        }),
      ),
    });
    const ok = await s.post("/api/student/attempts").set(H).send({ mode: "practice", topicId: fractions.id });
    expect(ok.status).toBe(201);
    expect(ok.body.source).toBe("ai");
    expect(ok.body.questions).toHaveLength(3);
    const saved = await mod.db().select().from(mod.schema.questions).where(and(eq(mod.schema.questions.topicId, fractions.id), eq(mod.schema.questions.source, "ai")));
    expect(saved.map((x) => x.prompt).sort()).toEqual(["What is 1/2 ÷ 1/4?", "What is 2/3 ÷ 1/3?", "What is 3/4 ÷ 1/2?"]);
    expect(JSON.stringify(ok.body)).not.toMatch(/correctIndex/);

    // Too few valid questions -> curated bank instead.
    reply = () => ({ json: message(JSON.stringify({ questions: [q("Only one", ["a", "b", "c", "d"], 0)] })) });
    const fallback = await s.post("/api/student/attempts").set(H).send({ mode: "practice", topicId: fractions.id });
    expect(fallback.body.source).toBe("rules");
    expect(fallback.body.questions.length).toBeGreaterThan(0);
  });

  it("teacher summary: generated by Claude from the student's data", async () => {
    const summary = { overview: "Aarav is uneven.", concerns: ["Fractions"], progress: "Steady.", suggestedActions: ["Reteach fractions"] };
    reply = () => ({ json: message(JSON.stringify(summary)) });
    const t = await login("anita.sharma@edugap.demo");
    const [aarav] = await mod.db().select().from(mod.schema.users).where(eq(mod.schema.users.email, "aarav@edugap.demo"));
    const res = await t.get(`/api/teacher/students/${aarav.id}/summary`);
    expect(res.body).toMatchObject({ source: "ai", summary });
  });
});
