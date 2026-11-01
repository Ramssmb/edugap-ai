import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["student", "teacher", "admin"]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const assessmentKindEnum = pgEnum("assessment_kind", ["diagnostic", "practice", "assigned"]);
export const gapStatusEnum = pgEnum("gap_status", ["strong", "needs_improvement", "weak"]);
export const recTypeEnum = pgEnum("rec_type", ["lesson", "practice"]);
export const recStatusEnum = pgEnum("rec_status", ["pending", "completed", "dismissed"]);
export const sourceEnum = pgEnum("content_source", ["ai", "rules"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    role: roleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    // Bumped on password change, reset, deactivation or role change; older session tokens stop working.
    sessionVersion: integer("session_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  grade: integer("grade").notNull(),
  teacherId: integer("teacher_id").references(() => users.id, { onDelete: "set null" }),
});

export const studentProfiles = pgTable("student_profiles", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  grade: integer("grade").notNull(),
  classId: integer("class_id").references(() => classes.id, { onDelete: "set null" }),
  preferredLanguage: varchar("preferred_language", { length: 8 }).notNull().default("en"),
  dailyQuestionGoal: integer("daily_question_goal").notNull().default(10),
  avatarColor: varchar("avatar_color", { length: 16 }).notNull().default("indigo"),
});

export const teacherProfiles = pgTable("teacher_profiles", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  department: varchar("department", { length: 80 }).notNull().default("General"),
  bio: text("bio"),
});

export const subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 60 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    description: text("description").notNull().default(""),
    color: varchar("color", { length: 16 }).notNull().default("indigo"),
    icon: varchar("icon", { length: 32 }).notNull().default("BookOpen"),
  },
  (t) => [uniqueIndex("subjects_slug_idx").on(t.slug)],
);

export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("topics_subject_slug_idx").on(t.subjectId, t.slug)],
);

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    concept: varchar("concept", { length: 120 }).notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation").notNull(),
    source: sourceEnum("source").notNull().default("rules"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("questions_topic_idx").on(t.topicId)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    summary: text("summary").notNull(),
    // Markdown-lite body: paragraphs separated by blank lines, "- " bullets, "## " headings.
    content: text("content").notNull(),
    keyPoints: jsonb("key_points").$type<string[]>().notNull().default([]),
    example: text("example").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull().default(10),
    level: difficultyEnum("level").notNull().default("easy"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lessons_topic_idx").on(t.topicId)],
);

/**
 * An assessment is a definition (which topics, how many questions). Teacher-assigned
 * assessments carry a fixed question list; diagnostic/practice ones are generated per
 * attempt so a retry gets fresh questions.
 */
export const assessments = pgTable(
  "assessments",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    kind: assessmentKindEnum("kind").notNull(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    topicIds: jsonb("topic_ids").$type<number[]>().notNull(),
    questionCount: integer("question_count").notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    classId: integer("class_id").references(() => classes.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assessments_class_idx").on(t.classId)],
);

export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assessmentId, t.questionId] })],
);

/** One attempt by one student. `questionIds` is the exact set served, so grading can't be gamed. */
export const assessmentResults = pgTable(
  "assessment_results",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionIds: jsonb("question_ids").$type<number[]>().notNull(),
    score: integer("score"),
    total: integer("total").notNull(),
    percent: real("percent"),
    topicBreakdown: jsonb("topic_breakdown").$type<TopicBreakdown[]>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("results_student_idx").on(t.studentId, t.completedAt),
    index("results_assessment_idx").on(t.assessmentId),
  ],
);

export type TopicBreakdown = {
  topicId: number;
  topicName: string;
  correct: number;
  total: number;
  percent: number;
};

export const studentAnswers = pgTable(
  "student_answers",
  {
    id: serial("id").primaryKey(),
    resultId: integer("result_id")
      .notNull()
      .references(() => assessmentResults.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    selectedIndex: integer("selected_index"),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("answers_student_topic_idx").on(t.studentId, t.topicId, t.answeredAt),
    index("answers_result_idx").on(t.resultId),
  ],
);

export type WeakConcept = { concept: string; missed: number; attempted: number };

export const knowledgeGaps = pgTable(
  "knowledge_gaps",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    mastery: real("mastery").notNull(),
    status: gapStatusEnum("status").notNull(),
    attempts: integer("attempts").notNull(),
    weakConcepts: jsonb("weak_concepts").$type<WeakConcept[]>().notNull().default([]),
    previousMastery: real("previous_mastery"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("gaps_student_topic_idx").on(t.studentId, t.topicId)],
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    type: recTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    reason: text("reason").notNull(),
    concepts: jsonb("concepts").$type<string[]>().notNull().default([]),
    priority: integer("priority").notNull(),
    status: recStatusEnum("status").notNull().default("pending"),
    source: sourceEnum("source").notNull().default("rules"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("recs_student_idx").on(t.studentId, t.status)],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.lessonId] })],
);

/** Daily mastery snapshot per subject, used for progress-over-time charts. */
export const progressRecords = pgTable(
  "progress_records",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    mastery: real("mastery").notNull(),
    recordedOn: varchar("recorded_on", { length: 10 }).notNull(), // YYYY-MM-DD
  },
  (t) => [uniqueIndex("progress_student_subject_day_idx").on(t.studentId, t.subjectId, t.recordedOn)],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activity_user_idx").on(t.userId, t.createdAt), index("activity_created_idx").on(t.createdAt)],
);
