import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { requireAuth, issueSession } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { passwordSchema } from "./auth.js";
import { studentProfile } from "../services/insights.js";
import { logActivity } from "../services/activity.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get("/", async (req, res) => {
  const u = req.user!;
  if (u.role === "student") return res.json({ role: u.role, ...(await studentProfile(u.id)) });
  const [base] = await db()
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, createdAt: schema.users.createdAt })
    .from(schema.users)
    .where(eq(schema.users.id, u.id));
  if (u.role === "teacher") {
    const [t] = await db().select().from(schema.teacherProfiles).where(eq(schema.teacherProfiles.userId, u.id));
    const cls = await db().select({ id: schema.classes.id, name: schema.classes.name }).from(schema.classes).where(eq(schema.classes.teacherId, u.id));
    return res.json({ role: u.role, ...base, department: t?.department ?? "", bio: t?.bio ?? "", classes: cls });
  }
  res.json({ role: u.role, ...base });
});

const updateSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120).optional(),
  preferredLanguage: z.enum(["en", "hi", "pa", "te"]).optional(),
  dailyQuestionGoal: z.coerce.number().int().min(5, "Minimum 5").max(100, "Maximum 100").optional(),
  department: z.string().trim().min(2, "Enter your department").max(80).optional(),
  bio: z.string().trim().max(500, "Keep it under 500 characters").optional(),
});

profileRouter.patch("/", async (req, res) => {
  const u = req.user!;
  const body = updateSchema.parse(req.body);
  if (body.name) await db().update(schema.users).set({ name: body.name }).where(eq(schema.users.id, u.id));
  if (u.role === "student" && (body.preferredLanguage || body.dailyQuestionGoal)) {
    await db()
      .update(schema.studentProfiles)
      .set({
        ...(body.preferredLanguage ? { preferredLanguage: body.preferredLanguage } : {}),
        ...(body.dailyQuestionGoal ? { dailyQuestionGoal: body.dailyQuestionGoal } : {}),
      })
      .where(eq(schema.studentProfiles.userId, u.id));
  }
  if (u.role === "teacher" && (body.department !== undefined || body.bio !== undefined)) {
    await db()
      .update(schema.teacherProfiles)
      .set({ ...(body.department ? { department: body.department } : {}), ...(body.bio !== undefined ? { bio: body.bio } : {}) })
      .where(eq(schema.teacherProfiles.userId, u.id));
  }
  res.json({ ok: true });
});

const passwordChange = z.object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: passwordSchema });

profileRouter.post("/password", async (req, res) => {
  const { currentPassword, newPassword } = passwordChange.parse(req.body);
  const [u] = await db().select().from(schema.users).where(eq(schema.users.id, req.user!.id));
  if (!(await bcrypt.compare(currentPassword, u.passwordHash)))
    throw new HttpError(400, "Current password is incorrect", { fields: { currentPassword: "Current password is incorrect" } });
  if (currentPassword === newPassword) throw new HttpError(400, "Choose a different password", { fields: { newPassword: "New password must be different" } });
  // Bump the session version so every other signed-in device is signed out, then re-issue this one.
  const [updated] = await db()
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(newPassword, 12), sessionVersion: u.sessionVersion + 1 })
    .where(eq(schema.users.id, u.id))
    .returning({ sessionVersion: schema.users.sessionVersion });
  issueSession(res, u.id, updated.sessionVersion);
  await logActivity(u.id, "security", "changed their password");
  res.json({ ok: true });
});
