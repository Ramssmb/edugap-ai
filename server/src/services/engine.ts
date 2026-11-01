/**
 * Knowledge-gap engine. Pure functions only — no database access — so the scoring
 * rules can be unit-tested and reasoned about in isolation.
 */

export type Difficulty = "easy" | "medium" | "hard";
export type GapStatus = "strong" | "needs_improvement" | "weak";

export type AnswerRecord = {
  questionId: number;
  topicId: number;
  concept: string;
  difficulty: Difficulty;
  isCorrect: boolean;
  answeredAt: Date;
  /** Attempt the answer belongs to. Answers from the same attempt count as equally recent. */
  resultId?: number;
  /** Row id, used only as a deterministic tie-break between equal timestamps. */
  answerId?: number;
};

export const DIFFICULTY_WEIGHT: Record<Difficulty, number> = { easy: 1, medium: 1.5, hard: 2 };
/** How many of the most recent answers per topic count towards mastery. */
export const MASTERY_WINDOW = 8;
/** Each earlier attempt counts this much less than the attempt after it. */
export const RECENCY_DECAY = 0.85;
export const STRONG_THRESHOLD = 75;
export const WEAK_THRESHOLD = 50;

export function classify(mastery: number): GapStatus {
  if (mastery >= STRONG_THRESHOLD) return "strong";
  if (mastery >= WEAK_THRESHOLD) return "needs_improvement";
  return "weak";
}

export type TopicMastery = {
  topicId: number;
  mastery: number; // 0-100, one decimal
  status: GapStatus;
  attempts: number; // answers inside the window
  weakConcepts: { concept: string; missed: number; attempted: number }[];
};

/**
 * Mastery for one topic: a difficulty- and recency-weighted share of correct answers
 * over the student's most recent MASTERY_WINDOW answers. Getting a hard question
 * right counts double an easy one; older attempts fade so improvement shows up.
 * Answers within one attempt share a timestamp, so they get the same recency weight,
 * and ties are broken by row id so the result never depends on database row order.
 */
export function topicMastery(topicId: number, answers: AnswerRecord[]): TopicMastery | null {
  const recent = answers
    .filter((a) => a.topicId === topicId)
    .sort((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime() || (b.answerId ?? 0) - (a.answerId ?? 0))
    .slice(0, MASTERY_WINDOW);
  if (recent.length === 0) return null;

  // Recency rank per attempt (newest attempt = 0). Answers without a resultId are their own attempt.
  const attemptRank = new Map<string, number>();
  const rankOf = (a: AnswerRecord, i: number) => {
    const key = a.resultId !== undefined ? `r${a.resultId}` : `a${i}`;
    if (!attemptRank.has(key)) attemptRank.set(key, attemptRank.size);
    return attemptRank.get(key)!;
  };

  let earned = 0;
  let possible = 0;
  recent.forEach((a, i) => {
    const w = DIFFICULTY_WEIGHT[a.difficulty] * Math.pow(RECENCY_DECAY, rankOf(a, i));
    possible += w;
    if (a.isCorrect) earned += w;
  });
  const mastery = Math.round((earned / possible) * 1000) / 10;

  const byConcept = new Map<string, { missed: number; attempted: number; lastCorrect: boolean }>();
  // `recent` is newest first, so the first time we see a concept is its latest answer.
  for (const a of recent) {
    const c = byConcept.get(a.concept);
    if (!c) byConcept.set(a.concept, { missed: a.isCorrect ? 0 : 1, attempted: 1, lastCorrect: a.isCorrect });
    else {
      c.attempted += 1;
      if (!a.isCorrect) c.missed += 1;
    }
  }
  // A concept is weak if the student misses it at least half the time, or got it
  // wrong on their most recent try.
  const weakConcepts = [...byConcept.entries()]
    .filter(([, c]) => c.missed > 0 && (c.missed / c.attempted >= 0.5 || !c.lastCorrect))
    .map(([concept, c]) => ({ concept, missed: c.missed, attempted: c.attempted }))
    .sort((a, b) => b.missed / b.attempted - a.missed / a.attempted || b.missed - a.missed);

  return { topicId, mastery, status: classify(mastery), attempts: recent.length, weakConcepts };
}

export function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}

// ---------------------------------------------------------------- grading

export type GradableQuestion = { id: number; topicId: number; correctIndex: number; options: unknown[] };

export function grade(
  served: GradableQuestion[],
  submitted: Map<number, number | null>,
): { score: number; total: number; percent: number; perQuestion: { questionId: number; topicId: number; selectedIndex: number | null; isCorrect: boolean }[] } {
  const perQuestion = served.map((q) => {
    const raw = submitted.get(q.id);
    const selectedIndex = typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < q.options.length ? raw : null;
    return { questionId: q.id, topicId: q.topicId, selectedIndex, isCorrect: selectedIndex === q.correctIndex };
  });
  const score = perQuestion.filter((p) => p.isCorrect).length;
  const total = served.length;
  return { score, total, percent: total ? Math.round((score / total) * 1000) / 10 : 0, perQuestion };
}

// ---------------------------------------------------------------- adaptive selection

export type PoolQuestion = { id: number; topicId: number; concept: string; difficulty: Difficulty };

/** Which difficulties to prefer for a student at a given mastery, best first. */
export function difficultyPreference(mastery: number | null): Difficulty[] {
  if (mastery === null) return ["medium", "easy", "hard"]; // no data yet: start in the middle
  if (mastery < WEAK_THRESHOLD) return ["easy", "medium", "hard"];
  if (mastery < STRONG_THRESHOLD) return ["medium", "hard", "easy"];
  return ["hard", "medium", "easy"];
}

/**
 * Picks `count` questions spread across `topicIds`. Within each topic it prefers
 * questions that (1) target the student's weak concepts, (2) match their level,
 * (3) were not seen recently. `rand` is injectable so tests are deterministic.
 */
export function selectQuestions(opts: {
  pool: PoolQuestion[];
  topicIds: number[];
  count: number;
  mastery: Map<number, number>;
  weakConcepts: Map<number, Set<string>>;
  recentlySeen: Set<number>;
  rand?: () => number;
}): number[] {
  const rand = opts.rand ?? Math.random;
  const topics = opts.topicIds.filter((t) => opts.pool.some((q) => q.topicId === t));
  if (topics.length === 0 || opts.count <= 0) return [];

  // Even split, with the remainder going to the weakest topics first.
  const order = [...topics].sort((a, b) => (opts.mastery.get(a) ?? 101) - (opts.mastery.get(b) ?? 101));
  const quota = new Map<number, number>(topics.map((t) => [t, Math.floor(opts.count / topics.length)]));
  for (let i = 0; i < opts.count % topics.length; i++) quota.set(order[i], quota.get(order[i])! + 1);

  const picked: number[] = [];
  const leftovers: PoolQuestion[] = [];
  for (const t of topics) {
    const prefs = difficultyPreference(opts.mastery.get(t) ?? null);
    const weak = opts.weakConcepts.get(t) ?? new Set<string>();
    const scored = opts.pool
      .filter((q) => q.topicId === t)
      .map((q) => ({
        q,
        score:
          (weak.has(q.concept) ? 4 : 0) +
          (2 - prefs.indexOf(q.difficulty)) +
          (opts.recentlySeen.has(q.id) ? -5 : 0) +
          rand(), // tie-breaker so retries vary
      }))
      .sort((a, b) => b.score - a.score);
    const n = quota.get(t)!;
    picked.push(...scored.slice(0, n).map((s) => s.q.id));
    leftovers.push(...scored.slice(n).map((s) => s.q));
  }
  // If a topic didn't have enough questions, top up from the others.
  for (const q of leftovers) {
    if (picked.length >= opts.count) break;
    picked.push(q.id);
  }
  // Shuffle so topics are interleaved.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

// ---------------------------------------------------------------- recommendations

export type RecDraft = {
  topicId: number;
  lessonId: number | null;
  type: "lesson" | "practice";
  title: string;
  reason: string;
  concepts: string[];
  priority: number;
};

export function buildRecommendations(input: {
  gaps: (TopicMastery & { topicName: string; previousMastery: number | null })[];
  lessonByTopic: Map<number, { id: number; title: string }>;
  /** Lessons the student completed after their latest answer on that topic. */
  lessonDoneSinceLastAttempt: Set<number>;
}): RecDraft[] {
  const drafts: RecDraft[] = [];
  const needs = input.gaps
    .filter((g) => g.status !== "strong")
    .sort((a, b) => a.mastery - b.mastery);

  needs.forEach((g) => {
    const concepts = g.weakConcepts.map((c) => c.concept);
    const conceptText = concepts.length
      ? ` You missed ${g.weakConcepts
          .slice(0, 2)
          .map((c) => `"${c.concept}" (${c.missed} of ${c.attempted})`)
          .join(" and ")}.`
      : "";
    const trend =
      g.previousMastery !== null && g.previousMastery !== g.mastery
        ? g.mastery > g.previousMastery
          ? ` Up from ${Math.round(g.previousMastery)}% — keep going.`
          : ` Down from ${Math.round(g.previousMastery)}%.`
        : "";
    // Priority comes from mastery itself (not rank), so recommendations generated
    // for different subjects interleave correctly: lower mastery = more urgent.
    const base = Math.round(g.mastery * 10) * 2;
    const lesson = input.lessonByTopic.get(g.topicId);

    if (lesson && !input.lessonDoneSinceLastAttempt.has(g.topicId)) {
      drafts.push({
        topicId: g.topicId,
        lessonId: lesson.id,
        type: "lesson",
        title: `Study: ${lesson.title}`,
        reason: `Your mastery of ${g.topicName} is ${Math.round(g.mastery)}%.${conceptText}${trend} This lesson explains these ideas from the beginning.`,
        concepts,
        priority: base,
      });
    }
    drafts.push({
      topicId: g.topicId,
      lessonId: null,
      type: "practice",
      title: `Practice: ${g.topicName}${concepts[0] ? ` — ${concepts[0]}` : ""}`,
      reason: input.lessonDoneSinceLastAttempt.has(g.topicId)
        ? `You've studied the lesson — now check your understanding with targeted questions on ${g.topicName}.${conceptText}`
        : `Targeted questions on ${g.topicName}, focused on the concepts you missed.${conceptText}`,
      concepts,
      priority: base + 1,
    });
  });
  return drafts;
}

// ---------------------------------------------------------------- streaks

/** Consecutive days with activity, counting back from today (or yesterday if today has none yet). */
export function computeStreak(activeDays: Set<string>, today: string): number {
  const d = new Date(today + "T00:00:00Z");
  if (!activeDays.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let streak = 0;
  while (activeDays.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

/** The school's local calendar day (YYYY-MM-DD), so goals and streaks roll over at local midnight. */
export const SCHOOL_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export const dayKey = (d: Date) => dayFormatter.format(d);
