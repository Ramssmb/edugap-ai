import { createApp } from "./app.js";
import { initDb, db, schema, closeDb } from "./db/index.js";
import { aiEnabled, config } from "./config.js";
import { seed } from "./db/seed.js";

async function main() {
  await initDb();
  // First run with an empty database: load the demo data automatically in development.
  // Demo accounts share a documented password, so production only seeds when asked to.
  const existing = await db().select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length === 0) {
    if (!config.isProd || process.env.SEED_DEMO_DATA === "true") {
      console.log("Empty database — loading demo data…");
      await seed({ reset: false });
    } else {
      console.warn("Empty database. Set SEED_DEMO_DATA=true to load demo data, or create an admin with `npm run create-admin`.");
    }
  }
  const server = createApp().listen(config.port, () => {
    console.log(`EduGap AI API listening on http://localhost:${config.port}`);
    console.log(`Database: ${config.databaseUrl ? "PostgreSQL (DATABASE_URL)" : `embedded PGlite at ${config.pgliteDir}`}`);
    console.log(`AI: ${aiEnabled() ? `Claude (${config.aiModel})` : "offline fallback mode (set ANTHROPIC_API_KEY to enable)"}`);
  });

  // Close the database cleanly on Ctrl+C, a dev-server restart or a host's stop signal;
  // an embedded database killed mid-write can be left unreadable.
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} received, shutting down…`);
    server.close();
    closeDb()
      .catch((err) => console.error("Error closing the database:", err))
      .finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref(); // never hang on shutdown
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
