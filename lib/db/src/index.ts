import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// An idle connection the database drops (a restart, a migration, an idle
// timeout) is reported here. Without a listener Node treats it as an
// unhandled error and the whole server crashes; the pool replaces the
// connection on the next query, so logging it is enough.
pool.on("error", (error) => {
  console.error("Postgres pool: idle connection error", error.message);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
