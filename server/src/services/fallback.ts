import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { curriculum } from "../data/curriculum.js";
import type { Report, StudentSummary } from "./ai.js";

/**
 * Offline mode: rule-based equivalents of the AI features, driven by the lesson
 * library and the student's real gap data. Used when no API key is configured or
 * an AI call fails.
 */

type TopicKnowledge = {
  topicId: number;
  topicName: string;
  subjectName: string;
  concepts: string[];
  lesson: { title: string; summary: string; keyPoints: string[]; example: string } | null;
  i18n: Record<string, string> | null;
  checks: { prompt: string; options: string[]; correctIndex: number; explanation: string; concept: string; difficulty: string; tokens: Set<string> }[];
  terms: Map<string, number>;
};

const i18nBySlug = new Map(curriculum.flatMap((s) => s.topics.map((t) => [`${s.slug}/${t.slug}`, t.i18n] as const)));

const STOP = new Set(
  "a an the is are was were be to of and or in on at for with how what why when which who do does did i me my you your it its this that can could please explain tell about help understand mean means meaning give some show example examples work works solve find get".split(" "),
);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

let cache: { at: number; items: TopicKnowledge[] } | null = null;
export function invalidateKnowledgeCache() {
  cache = null;
}

async function knowledge(): Promise<TopicKnowledge[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.items;
  const { topics, subjects, lessons, questions } = schema;
  const topicRows = await db()
    .select({ id: topics.id, name: topics.name, slug: topics.slug, description: topics.description, subjectName: subjects.name, subjectSlug: subjects.slug })
    .from(topics)
    .innerJoin(subjects, eq(subjects.id, topics.subjectId));
  const lessonRows = await db().select().from(lessons);
  const questionRows = await db()
    .select({ topicId: questions.topicId, concept: questions.concept, prompt: questions.prompt, options: questions.options, correctIndex: questions.correctIndex, explanation: questions.explanation, difficulty: questions.difficulty, source: questions.source })
    .from(questions);

  const items = topicRows.map((t) => {
    const lesson = lessonRows.find((l) => l.topicId === t.id) ?? null;
    const qs = questionRows.filter((q) => q.topicId === t.id);
    const concepts = [...new Set(qs.map((q) => q.concept))];
    const checks = qs
      .filter((q) => q.source === "rules")
      .map((q) => ({ prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation, concept: q.concept, difficulty: q.difficulty, tokens: new Set(tokenize(`${q.concept} ${q.prompt} ${q.explanation}`)) }));
    const terms = new Map<string, number>();
    const add = (text: string, w: number) => tokenize(text).forEach((tok) => terms.set(tok, Math.max(terms.get(tok) ?? 0, w)));
    add(lesson?.content ?? "", 0.5);
    add(t.description, 1);
    add(lesson?.title ?? "", 2);
    concepts.forEach((c) => add(c, 3));
    add(t.name, 5);
    return {
      topicId: t.id,
      topicName: t.name,
      subjectName: t.subjectName,
      concepts,
      lesson: lesson ? { title: lesson.title, summary: lesson.summary, keyPoints: lesson.keyPoints, example: lesson.example } : null,
      i18n: i18nBySlug.get(`${t.subjectSlug}/${t.slug}`) ?? null,
      checks,
      terms,
    };
  });
  cache = { at: Date.now(), items };
  return items;
}

export async function matchTopic(text: string): Promise<TopicKnowledge | null> {
  const toks = tokenize(text);
  if (!toks.length) return null;
  let best: TopicKnowledge | null = null;
  let bestScore = 0;
  for (const k of await knowledge()) {
    const score = toks.reduce((s, tok) => s + (k.terms.get(tok) ?? 0), 0);
    if (score > bestScore) {
      best = k;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const T = {
  en: { intro: "Here's a simple explanation", steps: "Step by step", example: "Worked example", check: "Quick check", answer: "Answer", focus: "From your results", none: "I couldn't match that to a topic I know yet. I can explain any of these:", greet: "Hi! I'm your EduGap tutor. Ask me about any topic — for example \"How do I add fractions with different denominators?\"", tip: "Tip: open the lesson from your Recommendations page to practise this." },
  hi: { intro: "आसान भाषा में समझें", steps: "चरण-दर-चरण", example: "उदाहरण", check: "जल्दी जाँचें", answer: "उत्तर", focus: "आपके परिणामों से", none: "मैं इसे किसी विषय से नहीं जोड़ पाया। मैं इन विषयों को समझा सकता हूँ:", greet: "नमस्ते! मैं आपका EduGap ट्यूटर हूँ। किसी भी विषय के बारे में पूछें।", tip: "सुझाव: अभ्यास के लिए Recommendations पेज से पाठ खोलें।" },
  pa: { intro: "ਆਸਾਨ ਭਾਸ਼ਾ ਵਿੱਚ ਸਮਝੋ", steps: "ਕਦਮ-ਦਰ-ਕਦਮ", example: "ਉਦਾਹਰਨ", check: "ਜਲਦੀ ਜਾਂਚ", answer: "ਜਵਾਬ", focus: "ਤੁਹਾਡੇ ਨਤੀਜਿਆਂ ਤੋਂ", none: "ਮੈਂ ਇਸਨੂੰ ਕਿਸੇ ਵਿਸ਼ੇ ਨਾਲ ਨਹੀਂ ਜੋੜ ਸਕਿਆ। ਮੈਂ ਇਹ ਵਿਸ਼ੇ ਸਮਝਾ ਸਕਦਾ ਹਾਂ:", greet: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ EduGap ਟਿਊਟਰ ਹਾਂ। ਕਿਸੇ ਵੀ ਵਿਸ਼ੇ ਬਾਰੇ ਪੁੱਛੋ।", tip: "ਸੁਝਾਅ: ਅਭਿਆਸ ਲਈ Recommendations ਪੰਨੇ ਤੋਂ ਪਾਠ ਖੋਲ੍ਹੋ।" },
  te: { intro: "సులభంగా అర్థం చేసుకోండి", steps: "దశల వారీగా", example: "ఉదాహరణ", check: "త్వరిత పరీక్ష", answer: "సమాధానం", focus: "మీ ఫలితాల నుండి", none: "దీన్ని నాకు తెలిసిన అంశంతో సరిపోల్చలేకపోయాను. నేను ఈ అంశాలను వివరించగలను:", greet: "నమస్కారం! నేను మీ EduGap ట్యూటర్‌ని. ఏ అంశం గురించైనా అడగండి.", tip: "సూచన: సాధన కోసం Recommendations పేజీ నుండి పాఠం తెరవండి." },
} as const;

export async function fallbackTutorReply(opts: {
  message: string;
  language: string;
  topicId?: number | null;
  weakConceptsByTopic: Map<number, string[]>;
}): Promise<string> {
  const t = T[(opts.language as keyof typeof T) in T ? (opts.language as keyof typeof T) : "en"];
  const all = await knowledge();
  const msg = opts.message.trim();

  if (/^(hi|hello|hey|namaste|hii+|good (morning|afternoon|evening))\b[!. ]*$/i.test(msg)) return t.greet;

  const k = (opts.topicId ? all.find((x) => x.topicId === opts.topicId) : null) ?? (await matchTopic(msg));
  if (!k) {
    const bySubject = new Map<string, string[]>();
    all.forEach((x) => bySubject.set(x.subjectName, [...(bySubject.get(x.subjectName) ?? []), x.topicName]));
    return `${t.none}\n\n${[...bySubject.entries()].map(([s, ts]) => `- **${s}:** ${ts.join(", ")}`).join("\n")}`;
  }

  const parts: string[] = [];
  parts.push(`### ${k.topicName} · ${k.subjectName}`);
  if (opts.language !== "en") {
    if (k.i18n?.[opts.language]) parts.push(`**${t.intro}:** ${k.i18n[opts.language]}`);
    parts.push("_The detailed steps below are in English. With an AI key configured, the whole answer is translated._");
  }
  if (k.lesson) {
    parts.push(k.lesson.summary);
    parts.push(`**${t.steps}**\n${k.lesson.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`);
    if (k.lesson.example) parts.push(`**${t.example}:** ${k.lesson.example}`);
  }
  const weak = opts.weakConceptsByTopic.get(k.topicId) ?? [];
  if (weak.length) parts.push(`**${t.focus}:** you have been missing questions on _${weak.join("_, _")}_. Read those steps slowly and try the check below.`);
  // Quick check: the question closest to what was asked, else one on a weak concept, else an easy one.
  const asked = new Set(tokenize(msg));
  const score = (c: TopicKnowledge["checks"][number]) =>
    [...asked].filter((tok) => c.tokens.has(tok)).length * 3 + (weak.includes(c.concept) ? 2 : 0) + (c.difficulty === "easy" ? 1 : c.difficulty === "medium" ? 0.5 : 0);
  const check = [...k.checks].sort((a, b) => score(b) - score(a))[0];
  if (check) {
    parts.push(
      `**${t.check}:** ${check.prompt}\n${check.options.map((o, i) => `${LETTERS[i]}. ${o}`).join("\n")}\n\n${t.answer}: ||${LETTERS[check.correctIndex]} — ${check.explanation}||`,
    );
  }
  parts.push(`_${t.tip}_`);
  return parts.join("\n\n");
}

// ---------------------------------------------------------------- report & summary

export type GapForReport = {
  topicName: string;
  subjectName: string;
  mastery: number;
  previousMastery: number | null;
  status: "strong" | "needs_improvement" | "weak";
  weakConcepts: { concept: string; missed: number; attempted: number }[];
};

export function fallbackReport(name: string, gaps: GapForReport[]): Report {
  const first = name.split(" ")[0];
  if (gaps.length === 0) {
    return {
      headline: `Welcome, ${first}! Take your first assessment to unlock your report.`,
      summary: "Once you complete an assessment, EduGap analyses every answer topic by topic and builds your personal plan.",
      strengths: [],
      focusAreas: [],
      weeklyPlan: [{ day: "Today", task: "Take a diagnostic assessment in any subject." }],
    };
  }
  const avg = gaps.reduce((s, g) => s + g.mastery, 0) / gaps.length;
  const strong = gaps.filter((g) => g.status === "strong").sort((a, b) => b.mastery - a.mastery);
  const weak = gaps.filter((g) => g.status !== "strong").sort((a, b) => a.mastery - b.mastery);
  const improved = gaps.filter((g) => g.previousMastery !== null && g.mastery > g.previousMastery);

  const headline =
    avg >= 75
      ? `Great work, ${first} — you're strong across most topics.`
      : avg >= 50
        ? `You're making solid progress, ${first}. A few concepts need attention.`
        : `${first}, let's build your foundations step by step — you can do this.`;
  const summary =
    `Your average mastery across ${gaps.length} assessed topics is ${Math.round(avg)}%. ` +
    (weak.length
      ? `${weak.length} topic${weak.length > 1 ? "s need" : " needs"} work, starting with ${weak[0].topicName} (${Math.round(weak[0].mastery)}%).`
      : "Every assessed topic is in the strong range.") +
    (improved.length ? ` You've improved in ${improved.map((g) => g.topicName).join(", ")}.` : "");

  const focusAreas = weak.slice(0, 4).map((g) => {
    const c = g.weakConcepts[0];
    return {
      topic: g.topicName,
      concept: c?.concept ?? "Core ideas",
      whyItMatters: c
        ? `You missed ${c.missed} of ${c.attempted} recent questions on this concept, which pulls ${g.topicName} down to ${Math.round(g.mastery)}%.`
        : `${g.topicName} is at ${Math.round(g.mastery)}% — below the 75% strong level.`,
      action: `Study the ${g.topicName} lesson, then take a targeted practice set${c ? ` on "${c.concept}"` : ""}.`,
    };
  });
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const tasks: string[] = [];
  for (const f of focusAreas) tasks.push(`Study the ${f.topic} lesson (focus: ${f.concept}).`, `Practice set: ${f.topic}.`);
  tasks.push("Retake a full assessment to measure your improvement.");
  while (tasks.length < 5) tasks.push(strong[tasks.length % Math.max(strong.length, 1)] ? `Challenge yourself: hard practice in ${strong[tasks.length % strong.length].topicName}.` : "Ask the AI tutor to explain anything you're unsure about.");

  return {
    headline,
    summary,
    strengths: strong.slice(0, 3).map((g) => `${g.topicName} (${g.subjectName}) — ${Math.round(g.mastery)}% mastery`),
    focusAreas,
    weeklyPlan: tasks.slice(0, 5).map((task, i) => ({ day: days[i], task })),
  };
}

export function fallbackStudentSummary(name: string, gaps: GapForReport[], recentScores: number[]): StudentSummary {
  if (gaps.length === 0)
    return { overview: `${name} has not completed any assessments yet.`, concerns: [], progress: "No data yet.", suggestedActions: ["Assign a diagnostic assessment."] };
  const avg = gaps.reduce((s, g) => s + g.mastery, 0) / gaps.length;
  const weak = gaps.filter((g) => g.status === "weak").sort((a, b) => a.mastery - b.mastery);
  const needs = gaps.filter((g) => g.status === "needs_improvement");
  let progress = "Not enough assessments to show a trend.";
  if (recentScores.length >= 2) {
    const half = Math.floor(recentScores.length / 2);
    const older = recentScores.slice(0, half);
    const newer = recentScores.slice(half);
    const d = newer.reduce((s, n) => s + n, 0) / newer.length - older.reduce((s, n) => s + n, 0) / older.length;
    progress = Math.abs(d) < 3 ? "Scores are steady over recent assessments." : d > 0 ? `Improving: recent scores are up about ${Math.round(d)} points.` : `Declining: recent scores are down about ${Math.round(-d)} points.`;
  }
  return {
    overview: `${name} averages ${Math.round(avg)}% mastery across ${gaps.length} topics, with ${weak.length} weak and ${needs.length} needing improvement.`,
    concerns: [...weak, ...needs].slice(0, 4).map((g) => `${g.topicName}: ${Math.round(g.mastery)}%${g.weakConcepts[0] ? ` — struggles with "${g.weakConcepts[0].concept}"` : ""}`),
    progress,
    suggestedActions: [
      ...(weak[0] ? [`Small-group reteach of ${weak[0].topicName}${weak[0].weakConcepts[0] ? `, focusing on ${weak[0].weakConcepts[0].concept}` : ""}.`] : []),
      ...(needs[0] ? [`Assign a short practice set on ${needs[0].topicName}.`] : []),
      "Check in on progress after the next assessment.",
    ].slice(0, 3),
  };
}
