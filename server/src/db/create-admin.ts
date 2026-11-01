import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { initDb, db, schema, closeDb } from "./index.js";
import { passwordSchema } from "../routes/auth.js";

/**
 * Creates the first administrator for a real deployment (no demo data):
 *   ADMIN_EMAIL=you@school.edu ADMIN_NAME="Your Name" ADMIN_PASSWORD=... npm run create-admin
 */
async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? "Administrator").trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Set ADMIN_EMAIL to a valid email address.");
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) throw new Error(`ADMIN_PASSWORD: ${pw.error.issues[0].message}`);

  await initDb();
  const [existing] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (existing) throw new Error(`A user with email ${email} already exists.`);
  await db().insert(schema.users).values({ email, name, role: "admin", passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Created administrator ${email}.`);
  await closeDb();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
