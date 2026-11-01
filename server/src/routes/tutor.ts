import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { gapsWithNames, describeGaps, studentProfile } from "../services/insights.js";
import { tutorReply, AiUnavailable } from "../services/ai.js";
import { fallbackTutorReply } from "../services/fallback.js";
import { aiEnabled, config } from "../config.js";

export const tutorRouter = Router();
tutorRouter.use(requireRole("student"));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  keyGenerator: (req) => `u${req.user!.id}`,
  message: { error: "You're sending messages quickly — take a breath and try again in a minute." },
});

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000, "Keep messages under 2000 characters") }))
    .min(1)
    .max(30),
  language: z.enum(["en", "hi", "pa", "te"]).default("en"),
  topicId: z.number().int().positive().nullable().optional(),
});

tutorRouter.get("/status", (_req, res) => {
  res.json({ mode: aiEnabled() ? "ai" : "offline" });
});

tutorRouter.post("/chat", limiter, async (req, res) => {
  const body = chatSchema.parse(req.body);
  const last = body.messages.at(-1)!;
  if (last.role !== "user") throw new HttpError(400, "The last message must be from the student");
  // Keep the conversation bounded; the API needs it to start with a user turn.
  let history = body.messages.slice(-12);
  while (history.length && history[0].role !== "user") history = history.slice(1);

  const gaps = await gapsWithNames(req.user!.id);
  try {
    const profile = await studentProfile(req.user!.id);
    const reply = await tutorReply({
      history,
      language: body.language,
      grade: profile?.grade ?? 8,
      studentName: req.user!.name.split(" ")[0],
      context: describeGaps(gaps),
    });
    return res.json({ reply, source: "ai" });
  } catch (err) {
    if (!(err instanceof AiUnavailable)) throw err;
  }
  const reply = await fallbackTutorReply({
    message: last.content,
    language: body.language,
    topicId: body.topicId ?? null,
    weakConceptsByTopic: new Map(gaps.map((g) => [g.topicId, g.weakConcepts.map((c) => c.concept)])),
  });
  res.json({ reply, source: "rules" });
});
