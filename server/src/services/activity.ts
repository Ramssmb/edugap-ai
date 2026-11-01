import { db, schema } from "../db/index.js";

export async function logActivity(userId: number | null, type: string, message: string, at = new Date()) {
  await db().insert(schema.activityLog).values({ userId, type, message, createdAt: at });
}
