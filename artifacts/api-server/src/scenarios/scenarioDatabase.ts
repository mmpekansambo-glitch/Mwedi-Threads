// A brand-new PostgreSQL database for one scenario run, built from
// lib/db/src/schema with drizzle-kit so it has exactly the app's tables.
// It sits next to the database PROJECTS_AUTH_TEST_DATABASE_URL names and is
// dropped at the end, so no real rows are ever touched.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

export type ScenarioDatabase = { url: string; drop: () => Promise<void> };

export async function createScenarioDatabase(baseUrl: string, dbPackage: string): Promise<ScenarioDatabase> {
  if (process.env.NODE_ENV === "production") throw new Error("Scenario stories cannot run in production.");
  const admin = new pg.Pool({ connectionString: baseUrl });
  const { rows } = await admin.query<{ database_name: string }>("SELECT current_database() AS database_name");
  if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
    await admin.end();
    throw new Error("Refusing to run scenario stories next to a production database.");
  }

  const name = `scenario_${process.pid}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  try {
    execFileSync("pnpm", ["exec", "drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"], {
      cwd: dbPackage,
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: "pipe",
    });
  } catch (error) {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
    throw error;
  }

  return {
    url: url.toString(),
    drop: async () => {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };
}

// lib/db, found from this file when run from source.
export const dbPackageFromSource = fileURLToPath(new URL("../../../../lib/db", import.meta.url));
