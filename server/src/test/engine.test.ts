import { describe, it, expect } from "vitest";
import { topicMastery, classify, grade, selectQuestions, buildRecommendations, computeStreak, type AnswerRecord } from "../services/engine.js";

const t0 = new Date("2026-10-01T10:00:00Z").getTime();
const ans = (i: number, isCorrect: boolean, concept = "A", difficulty: AnswerRecord["difficulty"] = "medium", topicId = 1): AnswerRecord => ({
  questionId: i,
  topicId,
  concept,
  difficulty,
  isCorrect,
  answeredAt: new Date(t0 + i * 60_000),
});

describe("classify", () => {
  it("uses 75/50 thresholds", () => {
    expect(classify(75)).toBe("strong");
    expect(classify(74.9)).toBe("needs_improvement");
    expect(classify(50)).toBe("needs_improvement");
    expect(classify(49.9)).toBe("weak");
  });
});

describe("topicMastery", () => {
  it("returns null with no answers on the topic", () => {
    expect(topicMastery(2, [ans(1, true)])).toBeNull();
  });

  it("is 100 when everything is right and 0 when everything is wrong", () => {
    expect(topicMastery(1, [ans(1, true), ans(2, true)])!.mastery).toBe(100);
    expect(topicMastery(1, [ans(1, false), ans(2, false)])!.mastery).toBe(0);
  });

  it("weights hard questions more than easy ones", () => {
    const hardRight = topicMastery(1, [ans(1, true, "A", "hard"), ans(2, false, "B", "easy")])!;
    const easyRight = topicMastery(1, [ans(1, false, "A", "hard"), ans(2, true, "B", "easy")])!;
    // Same recency pattern reversed, so compare against the unweighted 50%.
    expect(hardRight.mastery).toBeGreaterThan(easyRight.mastery);
  });

  it("rewards recent improvement over old mistakes", () => {
    const improving = topicMastery(1, [ans(1, false), ans(2, false), ans(3, true), ans(4, true)])!;
    const declining = topicMastery(1, [ans(1, true), ans(2, true), ans(3, false), ans(4, false)])!;
    expect(improving.mastery).toBeGreaterThan(50);
    expect(declining.mastery).toBeLessThan(50);
  });

  it("weights answers from the same attempt equally, whatever order they arrive in", () => {
    const at = new Date(t0);
    const a = { questionId: 1, topicId: 1, concept: "A", difficulty: "medium" as const, answeredAt: at, resultId: 7 };
    const right = { ...a, isCorrect: true, answerId: 1 };
    const wrong = { ...a, questionId: 2, isCorrect: false, answerId: 2 };
    // Same attempt: one right, one wrong, equal difficulty -> exactly 50%, in either order.
    expect(topicMastery(1, [right, wrong])!.mastery).toBe(50);
    expect(topicMastery(1, [wrong, right])!.mastery).toBe(50);
  });

  it("decays by attempt, not by answer position", () => {
    const old = { questionId: 1, topicId: 1, concept: "A", difficulty: "medium" as const, answeredAt: new Date(t0), resultId: 1, isCorrect: false };
    const newer = [2, 3].map((i) => ({ ...old, questionId: i, answeredAt: new Date(t0 + 60_000), resultId: 2, isCorrect: true, answerId: i }));
    // Two correct answers in the newest attempt (weight 1 each) + one wrong answer one attempt older (0.85).
    expect(topicMastery(1, [{ ...old, answerId: 1 }, ...newer])!.mastery).toBe(Math.round((2 / 2.85) * 1000) / 10);
  });

  it("only counts the 8 most recent answers", () => {
    const old = Array.from({ length: 10 }, (_, i) => ans(i, false));
    const recent = Array.from({ length: 8 }, (_, i) => ans(100 + i, true));
    const m = topicMastery(1, [...old, ...recent])!;
    expect(m.mastery).toBe(100);
    expect(m.attempts).toBe(8);
  });

  it("flags the exact concepts that were missed", () => {
    const m = topicMastery(1, [ans(1, true, "Adding"), ans(2, false, "Dividing"), ans(3, false, "Dividing"), ans(4, true, "Multiplying")])!;
    expect(m.weakConcepts.map((c) => c.concept)).toEqual(["Dividing"]);
    expect(m.weakConcepts[0]).toMatchObject({ missed: 2, attempted: 2 });
  });

  it("flags a concept whose latest answer was wrong even if earlier ones were right", () => {
    const m = topicMastery(1, [ans(1, true, "X"), ans(2, true, "X"), ans(3, false, "X")])!;
    expect(m.weakConcepts.map((c) => c.concept)).toEqual(["X"]);
  });
});

describe("grade", () => {
  const served = [
    { id: 1, topicId: 1, correctIndex: 2, options: ["a", "b", "c", "d"] },
    { id: 2, topicId: 1, correctIndex: 0, options: ["a", "b", "c", "d"] },
    { id: 3, topicId: 2, correctIndex: 1, options: ["a", "b", "c", "d"] },
  ];
  it("scores correct answers and treats missing/invalid answers as wrong", () => {
    const g = grade(served, new Map([[1, 2], [2, 9], [3, null]]));
    expect(g.score).toBe(1);
    expect(g.total).toBe(3);
    expect(g.percent).toBe(33.3);
    expect(g.perQuestion[1].selectedIndex).toBeNull();
  });
});

describe("selectQuestions", () => {
  const pool = [1, 2].flatMap((topicId) =>
    (["easy", "easy", "medium", "medium", "hard", "hard"] as const).map((difficulty, i) => ({ id: topicId * 10 + i, topicId, concept: `c${i % 3}`, difficulty })),
  );
  const seq = () => {
    let x = 0;
    return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  };

  it("splits evenly across topics and returns unique ids", () => {
    const ids = selectQuestions({ pool, topicIds: [1, 2], count: 6, mastery: new Map(), weakConcepts: new Map(), recentlySeen: new Set(), rand: seq() });
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(ids.filter((id) => id < 20)).toHaveLength(3);
  });

  it("prefers easy questions for weak students and weak concepts first", () => {
    const ids = selectQuestions({ pool, topicIds: [1], count: 2, mastery: new Map([[1, 20]]), weakConcepts: new Map([[1, new Set(["c2"])]]), recentlySeen: new Set(), rand: seq() });
    // c2 questions are index 2 (medium) and 5 (hard): weak concept outranks difficulty.
    expect(ids.sort()).toEqual([12, 15]);
  });

  it("avoids recently seen questions when alternatives exist", () => {
    const seen = new Set([10, 11, 12]);
    const ids = selectQuestions({ pool, topicIds: [1], count: 3, mastery: new Map(), weakConcepts: new Map(), recentlySeen: seen, rand: seq() });
    expect(ids.some((id) => seen.has(id))).toBe(false);
  });
});

describe("buildRecommendations", () => {
  const gap = (topicId: number, mastery: number, status: "strong" | "needs_improvement" | "weak") => ({
    topicId,
    topicName: `Topic ${topicId}`,
    mastery,
    status,
    attempts: 4,
    previousMastery: null,
    weakConcepts: status === "strong" ? [] : [{ concept: `Concept ${topicId}`, missed: 2, attempted: 3 }],
  });

  it("recommends a lesson and practice for each non-strong topic, weakest first", () => {
    const recs = buildRecommendations({
      gaps: [gap(1, 90, "strong"), gap(2, 60, "needs_improvement"), gap(3, 20, "weak")],
      lessonByTopic: new Map([[2, { id: 20, title: "L2" }], [3, { id: 30, title: "L3" }]]),
      lessonDoneSinceLastAttempt: new Set(),
    });
    expect(recs.map((r) => [r.topicId, r.type])).toEqual([[3, "lesson"], [3, "practice"], [2, "lesson"], [2, "practice"]]);
    expect(recs[0].reason).toContain("Concept 3");
    expect(recs[0].priority).toBeLessThan(recs[2].priority);
  });

  it("skips the lesson once it has been studied since the last attempt", () => {
    const recs = buildRecommendations({ gaps: [gap(3, 20, "weak")], lessonByTopic: new Map([[3, { id: 30, title: "L3" }]]), lessonDoneSinceLastAttempt: new Set([3]) });
    expect(recs.map((r) => r.type)).toEqual(["practice"]);
    expect(recs[0].reason).toMatch(/studied the lesson/);
  });
});

describe("computeStreak", () => {
  it("counts back from today, or from yesterday if today has no activity yet", () => {
    expect(computeStreak(new Set(["2026-10-10", "2026-10-09", "2026-10-07"]), "2026-10-10")).toBe(2);
    expect(computeStreak(new Set(["2026-10-09", "2026-10-08"]), "2026-10-10")).toBe(2);
    expect(computeStreak(new Set(["2026-10-07"]), "2026-10-10")).toBe(0);
  });
});
