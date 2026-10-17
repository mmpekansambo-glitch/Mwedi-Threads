// Runs before `drizzle-kit push`. The push links projects.owner_id to
// users.id, which fails if a project owner has no users row yet. This
// creates the users table (matching src/schema/users.ts) and adds a row for
// every existing project owner. Email and display name stay empty and are
// filled in from Clerk the next time that person uses the app.
// Safe to run more than once.
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY NOT NULL,
      "email" text,
      "display_name" text,
      "joined_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  const { rows } = await client.query(
    `SELECT to_regclass('public.projects') IS NOT NULL AS "exists"`,
  );
  if (rows[0]?.exists) {
    const result = await client.query(`
      INSERT INTO "users" ("id", "joined_at")
      SELECT "owner_id", min("created_at")
      FROM "projects"
      GROUP BY "owner_id"
      ON CONFLICT ("id") DO NOTHING
    `);
    console.log(`Added ${result.rowCount} users row(s) for existing project owners.`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
