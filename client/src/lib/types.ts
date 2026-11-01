import type { GapStatus } from "./utils";

export type WeakConcept = { concept: string; missed: number; attempted: number };

export type Gap = {
  topicId: number;
  topicName: string;
  subjectId: number;
  subjectName: string;
  mastery: number;
  previousMastery: number | null;
  status: GapStatus;
  attempts: number;
  weakConcepts: WeakConcept[];
  updatedAt: string;
};

export type Topic = { id: number; subjectId: number; slug: string; name: string; description: string; sortOrder: number };
export type Subject = { id: number; slug: string; name: string; description: string; color: string; icon: string; topics: Topic[] };

export type Recommendation = {
  id: number;
  type: "lesson" | "practice";
  title: string;
  reason: string;
  concepts: string[];
  priority: number;
  status: "pending" | "completed" | "dismissed";
  source: "ai" | "rules";
  createdAt: string;
  completedAt: string | null;
  topicId: number;
  topicName: string;
  subjectName: string;
  subjectSlug: string;
  lessonId: number | null;
  lessonMinutes: number | null;
};

export type ResultSummary = { id: number; percent: number | null; score: number | null; total: number; completedAt: string; title: string; kind: string; subjectName: string };

export type StudentDashboard = {
  profile: { id: number; name: string; email: string; grade: number; className: string | null; classId: number | null; preferredLanguage: string; dailyQuestionGoal: number; avatarColor: string; createdAt: string } | null;
  stats: { overallMastery: number | null; assessmentsCompleted: number; lessonsCompleted: number; streak: number; topicsAssessed: number; totalTopics: number };
  subjects: { id: number; slug: string; name: string; color: string; icon: string; mastery: number | null; change: number | null; topicsAssessed: number; totalTopics: number }[];
  topics: { strong: Gap[]; needsImprovement: Gap[]; weak: Gap[] };
  dailyGoals: { key: string; label: string; current: number; target: number }[];
  recentResults: ResultSummary[];
  assigned: { id: number; title: string; dueAt: string | null; questionCount: number; subjectName: string; completed: boolean }[];
  recommendations: { id: number; type: "lesson" | "practice"; title: string; reason: string; lessonId: number | null; topicId: number; priority: number }[];
};

export type StudentProgress = {
  subjects: { id: number; slug: string; name: string; color: string }[];
  timeline: Record<string, number | string>[];
  history: (ResultSummary & { subjectId: number })[];
  comparison: { topicId: number; topicName: string; subjectName: string; then: number | null; now: number; status: GapStatus }[];
  calendar: { date: string; count: number }[];
  streak: number;
  lessonsCompleted: { id: number; title: string; completedAt: string; topicName: string }[];
};

export type AttemptQuestion = { id: number; prompt: string; options: string[]; difficulty: "easy" | "medium" | "hard"; topicName: string; source: "ai" | "rules" };
export type Attempt = {
  resultId: number;
  source?: "ai" | "rules";
  assessment: { id: number; title: string; kind: string; subjectName: string; subjectSlug: string };
  questions: AttemptQuestion[];
};

export type ResultDetail = {
  result: { id: number; studentId: number; score: number; total: number; percent: number; topicBreakdown: { topicId: number; topicName: string; correct: number; total: number; percent: number }[]; completedAt: string; startedAt: string; title: string; kind: string; subjectId: number; subjectName: string };
  answers: { questionId: number; selectedIndex: number | null; isCorrect: boolean; prompt: string; options: string[]; correctIndex: number; explanation: string; concept: string; difficulty: string; topicId: number; topicName: string }[];
  gaps: { topicId: number; topicName: string; mastery: number; previousMastery: number | null; status: GapStatus; weakConcepts: WeakConcept[] }[];
  missedConcepts: { concept: string; topicName: string; missed: number; total: number }[];
  recommendations: { id: number; type: "lesson" | "practice"; title: string; reason: string; lessonId: number | null; topicId: number }[];
  before?: { topicId: number; mastery: number; status: GapStatus }[];
};

export type RosterStudent = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  grade: number;
  classId: number | null;
  className: string | null;
  avatarColor: string;
  mastery: number | null;
  assessments: number;
  lastActive: string | null;
  trend: number | null;
  weakCount: number;
  weakestTopic: { name: string; mastery: number; concept: string | null } | null;
  needsAttention: boolean;
  attentionReasons: string[];
};
