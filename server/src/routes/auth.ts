import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { eq, asc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { issueSession, clearSession } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { logActivity } from "../services/activity.js";
import { config } from "../config.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  // Count failures only: a whole class signing in from one school IP must not be blocked.
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(255);
const name = z.string().trim().min(2, "Enter your full name").max(120);

const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("student"),
    name,
    email,
    password: passwordSchema,
    grade: z.coerce.number().int().min(6, "Grade 6-12").max(12, "Grade 6-12"),
    classId: z.coerce.number().int().positive().nullable().optional(),
  }),
  z.object({ role: z.literal("teacher"), name, email, password: passwordSchema, department: z.string().trim().min(2, "Enter your department").max(80) }),
]);

const COLORS = ["indigo", "violet", "sky", "emerald", "amber", "rose", "teal", "fuchsia"];

/** Public list of classes so a new student can pick theirs. Names only. */
authRouter.get("/classes", async (_req, res) => {
  const rows = await db()
    .select({ id: schema.classes.id, name: schema.classes.name, grade: schema.classes.grade })
    .from(schema.classes)
    .orderBy(asc(schema.classes.name));
  res.json(rows);
});

authRouter.post("/register", authLimiter, async (req, res) => {
  const body = registerSchema.parse(req.body);
  const existing = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, body.email));
  if (existing.length) throw new HttpError(409, "An account with this email already exists", { fields: { email: "This email is already registered" } });
  if (body.role === "student" && body.classId) {
    const [c] = await db().select().from(schema.classes).where(eq(schema.classes.id, body.classId));
    if (!c) throw new HttpError(400, "That class does not exist");
  }
  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await db().transaction(async (tx) => {
    // Teachers can see students' answers and the answer key, so a self-registered
    // teacher account stays inactive until an administrator approves it.
    const [u] = await tx
      .insert(schema.users)
      .values({ email: body.email, name: body.name, passwordHash, role: body.role, isActive: body.role === "student", lastLoginAt: body.role === "student" ? new Date() : null })
      .returning();
    if (body.role === "student") {
      await tx.insert(schema.studentProfiles).values({ userId: u.id, grade: body.grade, classId: body.classId ?? null, avatarColor: COLORS[u.id % COLORS.length] });
    } else {
      await tx.insert(schema.teacherProfiles).values({ userId: u.id, department: body.department });
    }
    return u;
  });
  if (user.role === "teacher") {
    await logActivity(user.id, "register", "requested a teacher account (awaiting approval)");
    return res.status(201).json({ pending: true });
  }
  await logActivity(user.id, "register", `joined as a ${user.role}`);
  issueSession(res, user.id, user.sessionVersion);
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(128) });

// Same cost as a real hash, so response time does not reveal whether an email exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-1", 12);

authRouter.post("/login", authLimiter, async (req, res) => {
  const { email: e, password } = loginSchema.parse(req.body);
  const [u] = await db().select().from(schema.users).where(eq(schema.users.email, e));
  const ok = await bcrypt.compare(password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !ok) throw new HttpError(401, "Incorrect email or password");
  if (!u.isActive)
    throw new HttpError(403, u.lastLoginAt === null && u.role === "teacher" ? "Your teacher account is waiting for administrator approval." : "This account has been deactivated. Please contact your administrator.");
  await db().update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, u.id));
  await logActivity(u.id, "login", "signed in");
  issueSession(res, u.id, u.sessionVersion);
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// Returns { user: null } when signed out, so public pages don't log a 401 on every load.
authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ?? null });
});
