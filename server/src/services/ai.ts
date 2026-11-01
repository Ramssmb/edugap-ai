import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config, aiEnabled } from "../config.js";

/**
 * Thin wrapper around the Claude API. The key lives only in the server
 * environment; the browser never sees it. Every caller has a rules-based
 * fallback, so any failure here (no key, network, refusal, invalid output)
 * degrades to offline mode instead of breaking the feature.
 */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: config.anthropicApiKey, timeout: 45_000, maxRetries: 1 });
  return client;
}

const BETAS = ["server-side-fallback-2026-07-01"];

export class AiUnavailable extends Error {}

export const LANGUAGE_NAMES: Record<string, string> = { en: "English", hi: "Hindi", pa: "Punjabi", te: "Telugu" };

export type ChatTurn = { role: "user" | "assistant"; content: string };

function handleError(err: unknown): never {
  if (err instanceof Anthropic.AuthenticationError) console.warn("[ai] Invalid ANTHROPIC_API_KEY; using fallback.");
  else if (err instanceof Anthropic.RateLimitError) console.warn("[ai] Rate limited; using fallback.");
  else if (err instanceof Anthropic.APIError) console.warn(`[ai] API error ${err.status}; using fallback.`);
  else if (err instanceof AiUnavailable) throw err;
  else console.warn("[ai] Request failed; using fallback.", err instanceof Error ? err.message : err);
  throw new AiUnavailable("AI request failed");
}

/** Free-form tutor reply. */
export async function tutorReply(opts: {
  history: ChatTurn[];
  language: string;
  grade: number;
  studentName: string;
  context: string;
}): Promise<string> {
  if (!aiEnabled()) throw new AiUnavailable("No API key configured");
  const lang = LANGUAGE_NAMES[opts.language] ?? "English";
  const system = `You are EduGap Tutor, a patient, encouraging tutor for a Grade ${opts.grade} student named ${opts.studentName}.

Rules:
- Reply in ${lang}${lang !== "English" ? ` (use ${lang} script; keep maths symbols and technical terms like formulas as they are)` : ""}.
- Explain at a Grade ${opts.grade} level: short sentences, everyday examples, no jargon without a definition.
- For "how do I" or problem questions, give numbered steps and a worked example, then one quick check-your-understanding question.
- If the student asks for an answer to a test question, guide them to it instead of just giving it.
- Stay on school subjects. Politely redirect anything unrelated or unsafe.
- Keep replies under about 250 words. Use simple Markdown (bold, lists) only.

What we know about this student's learning (from their real assessment results):
${opts.context}`;
  try {
    const res = await getClient().beta.messages.create({
      model: config.aiModel,
      max_tokens: 4000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      messages: opts.history.map((m) => ({ role: m.role, content: m.content })),
    });
    if (res.stop_reason === "refusal") throw new AiUnavailable("Model declined");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (!text) throw new AiUnavailable("Empty reply");
    return text;
  } catch (err) {
    handleError(err);
  }
}

async function structured<T extends z.ZodType>(schema: T, system: string, prompt: string, maxTokens = 8000): Promise<z.infer<T>> {
  if (!aiEnabled()) throw new AiUnavailable("No API key configured");
  try {
    const res = await getClient().beta.messages.parse({
      model: config.aiModel,
      max_tokens: maxTokens,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new AiUnavailable("No structured output");
    return res.parsed_output as z.infer<T>;
  } catch (err) {
    handleError(err);
  }
}

// ---------------------------------------------------------------- improvement report

export const ReportSchema = z.object({
  headline: z.string().describe("One encouraging sentence summarising where the student is"),
  summary: z.string().describe("2-3 sentences, addressed to the student as 'you'"),
  strengths: z.array(z.string()).describe("Up to 3 specific strengths backed by the data"),
  focusAreas: z
    .array(
      z.object({
        topic: z.string(),
        concept: z.string().describe("The specific concept they struggle with"),
        whyItMatters: z.string(),
        action: z.string().describe("A concrete next step"),
      }),
    )
    .describe("Up to 4, weakest first"),
  weeklyPlan: z.array(z.object({ day: z.string(), task: z.string() })).describe("5 short daily tasks"),
});
export type Report = z.infer<typeof ReportSchema>;

export function aiImprovementReport(opts: { name: string; grade: number; data: string }) {
  return structured(
    ReportSchema,
    `You are an expert learning coach. Write a personalised improvement report for a Grade ${opts.grade} student from their real assessment data. Be specific: name topics, concepts and percentages from the data. Never invent results that are not in the data. Warm, motivating, plain language.`,
    `Student: ${opts.name}\n\nAssessment data:\n${opts.data}`,
  );
}

// ---------------------------------------------------------------- question generation

export const GeneratedQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      concept: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      prompt: z.string(),
      options: z.array(z.string()).describe("Exactly 4 options"),
      correctIndex: z.number().int().describe("0-based index of the correct option"),
      explanation: z.string().describe("Beginner-friendly explanation of why the answer is right"),
    }),
  ),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionsSchema>["questions"][number];

export async function aiPracticeQuestions(opts: {
  subject: string;
  topic: string;
  concepts: string[];
  allowedConcepts: string[];
  grade: number;
  count: number;
  examples: string;
}): Promise<GeneratedQuestion[]> {
  const out = await structured(
    GeneratedQuestionsSchema,
    `You write accurate multiple-choice practice questions for Grade ${opts.grade} students. Each question has exactly 4 options and exactly one correct answer. Distractors should reflect common misconceptions. Double-check every calculation. Use the concept labels exactly as given.`,
    `Subject: ${opts.subject}\nTopic: ${opts.topic}\nWrite ${opts.count} questions. Focus on these concepts the student is weak in: ${opts.concepts.join(", ") || "the core ideas of the topic"}.\nAllowed concept labels: ${opts.allowedConcepts.join(", ")}\nStart easy and get slightly harder.\n\nExamples of the style (do not copy them):\n${opts.examples}`,
  );
  // Validate beyond the schema: reject anything malformed rather than serve a broken question.
  return out.questions.filter(
    (q) =>
      q.options.length === 4 &&
      new Set(q.options.map((o) => o.trim().toLowerCase())).size === 4 &&
      q.correctIndex >= 0 &&
      q.correctIndex < 4 &&
      q.prompt.trim().length > 5 &&
      opts.allowedConcepts.includes(q.concept),
  );
}

// ---------------------------------------------------------------- teacher summary

export const StudentSummarySchema = z.object({
  overview: z.string().describe("2-3 sentences for the teacher"),
  concerns: z.array(z.string()).describe("Specific learning concerns, most urgent first, max 4"),
  progress: z.string().describe("One sentence on the trend"),
  suggestedActions: z.array(z.string()).describe("Max 3 concrete classroom actions"),
});
export type StudentSummary = z.infer<typeof StudentSummarySchema>;

export function aiStudentSummary(opts: { name: string; grade: number; data: string }) {
  return structured(
    StudentSummarySchema,
    `You are an experienced teaching assistant. Summarise a Grade ${opts.grade} student's performance for their teacher using only the data provided. Be specific and actionable; cite topics, concepts and percentages.`,
    `Student: ${opts.name}\n\nData:\n${opts.data}`,
  );
}
