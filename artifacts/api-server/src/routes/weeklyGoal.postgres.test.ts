import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { craftActivitySql } from "../test/stashTablesSql";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const ownerA = "weekly-goal-test-user-a";
const ownerB = "weekly-goal-test-user-b";

let schemaName: string | undefined;
let schemaCreated = false;
let adminPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;
let server: ReturnType<express.Express["listen"]> | undefined;
let baseUrl: string;

function quoteIsolatedSchema(name: string): string {
  if (!/^weekly_goal_test_[0-9]+_[0-9a-f]+$/.test(name)) {
    throw new Error("Refusing to use an unexpected PostgreSQL test schema name.");
  }
  return `"${name}"`;
}

function getTestDb() {
  if (!testDb) throw new Error("PostgreSQL test database was not initialized.");
  return testDb;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function read(response: Response): Promise<any> {
  return response.json();
}

async function request(path: string, options: { method?: string; user?: string; body?: unknown } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.user ? { "x-test-user": options.user } : {}),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

// Wednesday 4 Nov 2026 in Los Angeles; the week runs Mon 2 to Sun 8 Nov.
const today = "2026-11-04";
const week = (studio: string, zone = "America/Los_Angeles") => `/weekly-goal?studio=${studio}&today=${today}&timeZone=${encodeURIComponent(zone)}`;

async function addNote(table: "project_progress_entries" | "sewing_project_entries", projectId: string, at: string) {
  const id = randomUUID();
  await testPool!.query(`INSERT INTO ${table} (id, project_id, created_at) VALUES ($1, $2, $3)`, [id, projectId, at]);
  return id;
}

describe.skipIf(!databaseUrl)("weekly goal against PostgreSQL", () => {
  let yarnProject: string;
  let sewingProject: string;

  beforeAll(async () => {
    if (process.env.NODE_ENV === "production") throw new Error("PostgreSQL tests cannot run in production.");
    adminPool = new pg.Pool({ connectionString: databaseUrl });
    const { rows } = await adminPool.query<{ database_name: string }>("SELECT current_database() AS database_name");
    if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
      throw new Error("Refusing to run PostgreSQL tests against a production database.");
    }
    schemaName = `weekly_goal_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
    const isolatedSchema = quoteIsolatedSchema(schemaName);
    await adminPool.query(`CREATE SCHEMA ${isolatedSchema}`);
    schemaCreated = true;
    // Only the journal columns the goal reads.
    await adminPool.query(`
      CREATE TABLE ${isolatedSchema}.users (
        id text PRIMARY KEY,
        email text,
        display_name text,
        joined_at timestamptz NOT NULL DEFAULT now(),
        yarn_enabled boolean NOT NULL DEFAULT true,
        sewing_enabled boolean NOT NULL DEFAULT false,
        crafts_chosen_at timestamptz,
        yarn_weekly_goal integer,
        sewing_weekly_goal integer
      );
      CREATE TABLE ${isolatedSchema}.projects (id uuid PRIMARY KEY, owner_id text NOT NULL);
      CREATE TABLE ${isolatedSchema}.project_progress_entries (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES ${isolatedSchema}.projects(id) ON DELETE CASCADE, created_at timestamptz NOT NULL);
      CREATE TABLE ${isolatedSchema}.sewing_projects (id uuid PRIMARY KEY, owner_id text NOT NULL);
      CREATE TABLE ${isolatedSchema}.sewing_project_entries (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES ${isolatedSchema}.sewing_projects(id) ON DELETE CASCADE, created_at timestamptz NOT NULL);
      ${craftActivitySql(isolatedSchema)}
    `);
    testPool = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schemaName}` });
    testDb = drizzle(testPool, { schema });
    vi.doMock("@workspace/db", async () => ({ ...schema, db: getTestDb() }));
    const { default: weeklyGoalRouter } = await import("./weeklyGoal");
    const app = express();
    app.use(express.json());
    app.use(weeklyGoalRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start.");
    baseUrl = `http://127.0.0.1:${address.port}`;

    await getTestDb().insert(usersTable).values([{ id: ownerA }, { id: ownerB }]);
    yarnProject = randomUUID();
    sewingProject = randomUUID();
    await testPool.query("INSERT INTO projects (id, owner_id) VALUES ($1, $2)", [yarnProject, ownerA]);
    await testPool.query("INSERT INTO sewing_projects (id, owner_id) VALUES ($1, $2)", [sewingProject, ownerA]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await testPool?.end();
    if (schemaCreated && schemaName) await adminPool?.query(`DROP SCHEMA ${quoteIsolatedSchema(schemaName)} CASCADE`);
    await adminPool?.end();
  });

  it("starts with no goal and an empty week", async () => {
    expect(await read(await request(week("yarn"), { user: ownerA }))).toEqual({
      goal: null, weekStart: "2026-11-02", days: [false, false, false, false, false, false, false], count: 0, todayCounted: false, weeksInARow: 0,
    });
    expect((await request("/weekly-goal?studio=knitting&today=2026-11-04", { user: ownerA })).status).toBe(400);
    expect((await request("/weekly-goal?studio=yarn", { user: ownerA })).status).toBe(400);
    expect((await request(week("yarn"))).status).toBe(401);
  });

  it("counts note days on the maker's own calendar, one studio at a time", async () => {
    // Monday 9pm in Los Angeles is already Tuesday in UTC.
    await addNote("project_progress_entries", yarnProject, "2026-11-03T05:00:00Z");
    await addNote("project_progress_entries", yarnProject, "2026-11-03T06:00:00Z"); // same Monday evening
    await addNote("sewing_project_entries", sewingProject, "2026-11-04T18:00:00Z");
    const yarn = await read(await request(week("yarn"), { user: ownerA }));
    expect(yarn.days).toEqual([true, false, false, false, false, false, false]);
    expect(yarn.count).toBe(1);
    const utc = await read(await request(week("yarn", "UTC"), { user: ownerA }));
    expect(utc.days).toEqual([false, true, false, false, false, false, false]);
    const sewing = await read(await request(week("sewing"), { user: ownerA }));
    expect(sewing).toMatchObject({ count: 1, todayCounted: true });
    expect((await read(await request(week("yarn"), { user: ownerB }))).count).toBe(0);
  });

  it("sets, changes and turns off each studio's goal", async () => {
    expect((await request(week("yarn"), { method: "PUT", user: ownerA, body: { goal: 8 } })).status).toBe(400);
    expect((await request(week("yarn"), { method: "PUT", user: ownerA, body: { goal: 0 } })).status).toBe(400);
    expect(await read(await request(week("yarn"), { method: "PUT", user: ownerA, body: { goal: 2 } }))).toMatchObject({ goal: 2, count: 1 });
    expect((await read(await request(week("sewing"), { user: ownerA }))).goal).toBeNull();
    expect((await read(await request(week("yarn"), { method: "PUT", user: ownerA, body: { goal: null } }))).goal).toBeNull();
    await request(week("yarn"), { method: "PUT", user: ownerA, body: { goal: 2 } });
  });

  it("checks in today and keeps the day after its note is deleted", async () => {
    const checkIn = (studio: string) => request(`/weekly-goal/check-in?studio=${studio}&today=${today}&timeZone=UTC`, { method: "POST", user: ownerA });
    expect((await checkIn("yarn")).status).toBe(200);
    expect((await checkIn("yarn")).status).toBe(200);
    const rows = await testPool!.query("SELECT count(*)::int AS n FROM craft_activity WHERE user_id = $1", [ownerA]);
    expect(rows.rows[0].n).toBe(1);

    // A note written through the app logs its hour too; deleting the note keeps it.
    const noteAt = "2026-11-04T17:20:00Z";
    const noteId = await addNote("project_progress_entries", yarnProject, noteAt);
    await testPool!.query("INSERT INTO craft_activity (user_id, studio, hour) VALUES ($1, 'yarn', date_trunc('hour', $2::timestamptz))", [ownerA, noteAt]);
    await testPool!.query("DELETE FROM project_progress_entries WHERE id = $1", [noteId]);
    const after = await read(await request(week("yarn"), { user: ownerA }));
    expect(after).toMatchObject({ count: 2, todayCounted: true, weeksInARow: 1 });
  });

  it("counts weeks in a row that met the goal", async () => {
    for (const day of ["2026-10-26", "2026-10-28", "2026-10-19", "2026-10-21"]) {
      await addNote("project_progress_entries", yarnProject, `${day}T18:00:00Z`);
    }
    expect((await read(await request(week("yarn"), { user: ownerA }))).weeksInARow).toBe(3);
  });
});
