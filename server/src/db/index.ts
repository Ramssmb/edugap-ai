import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema.js";
import { config, SERVER_ROOT } from "../config.js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

let dbInstance: DB | null = null;
let closeFn: (() => Promise<void>) | null = null;
const MIGRATIONS = path.join(SERVER_ROOT, "drizzle");

/**
 * Connects to PostgreSQL when DATABASE_URL is set; otherwise starts an embedded
 * Postgres (PGlite) so the app runs with zero external setup. Both run the same
 * SQL migrations from ./drizzle.
 */
export async function initDb(): Promise<DB> {
  if (dbInstance) return dbInstance;
  if (config.databaseUrl) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    // Honour channel_binding=require (Neon adds it); pg parses but otherwise ignores it.
    const enableChannelBinding = /[?&]channel_binding=require(&|$)/.test(config.databaseUrl);
    const pool = new Pool({ connectionString: config.databaseUrl, max: 10, enableChannelBinding });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    dbInstance = db as unknown as DB;
    closeFn = () => pool.end();
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    let client;
    if (config.pgliteDir === "memory") client = new PGlite();
    else {
      fs.mkdirSync(config.pgliteDir, { recursive: true });
      client = new PGlite(config.pgliteDir);
    }
    const db = drizzle(client, { schema });
    try {
      await migrate(db, { migrationsFolder: MIGRATIONS });
    } catch (err) {
      // The embedded database is a set of local files; a hard kill mid-write (or a sync
      // tool such as OneDrive touching them) can leave them unreadable.
      if (config.pgliteDir !== "memory")
        throw new Error(
          `The local database in ${config.pgliteDir} could not be opened (it may be damaged after the server was stopped abruptly). ` +
            "Stop the server, delete that folder, and start again to recreate the demo data.",
          { cause: err },
        );
      throw err;
    }
    dbInstance = db as unknown as DB;
    closeFn = () => client.close();
  }
  return dbInstance;
}

export function db(): DB {
  if (!dbInstance) throw new Error("Database not initialised; call initDb() first");
  return dbInstance;
}

export async function closeDb() {
  await closeFn?.();
  dbInstance = null;
  closeFn = null;
}

export { schema };
