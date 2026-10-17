import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { progressEntriesTable, projectsTable, usersTable } from "@workspace/db/schema";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const ownerA = "postgres-test-user-a";
const ownerB = "postgres-test-user-b";
const projectAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const progressAId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const progressBId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let schemaName: string | undefined;
let schemaCreated = false;
let adminPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;
let server: ReturnType<express.Express["listen"]> | undefined;
let baseUrl: string;

function quoteIsolatedSchema(name: string): string {
  if (!/^projects_auth_test_[0-9]+_[0-9a-f]+$/.test(name)) {
    throw new Error("Refusing to use an unexpected PostgreSQL test schema name.");
  }
  return `"${name}"`;
}

function getTestDb() {
  if (!testDb) throw new Error("PostgreSQL test database was not initialized.");
  return testDb;
}

async function request(
  path: string,
  options: { method?: string; user?: string; body?: unknown } = {},
) {
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.user ? { "x-test-user": options.user } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}

describe.skipIf(!databaseUrl)("project authorization against PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PostgreSQL authorization tests cannot run in production.");
    }
    if (!databaseUrl) {
      throw new Error("Set PROJECTS_AUTH_TEST_DATABASE_URL to a non-production PostgreSQL URL.");
    }

    adminPool = new pg.Pool({ connectionString: databaseUrl });
    const { rows } = await adminPool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
      throw new Error("Refusing to run PostgreSQL authorization tests against a production database.");
    }

    schemaName = `projects_auth_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
    const isolatedSchema = quoteIsolatedSchema(schemaName);
    await adminPool.query(`CREATE SCHEMA ${isolatedSchema}`);
    schemaCreated = true;
    await adminPool.query(`
      CREATE TYPE ${isolatedSchema}.craft_type AS ENUM ('knitting', 'crochet');
      CREATE TYPE ${isolatedSchema}.project_status AS ENUM ('planning', 'in_progress', 'paused', 'completed');
      CREATE TYPE ${isolatedSchema}.project_date_precision AS ENUM ('month', 'day');
      CREATE TABLE ${isolatedSchema}.users (
        id text PRIMARY KEY,
        email text,
        display_name text,
        joined_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ${isolatedSchema}.projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id text NOT NULL REFERENCES ${isolatedSchema}.users(id),
        title text NOT NULL,
        craft ${isolatedSchema}.craft_type NOT NULL,
        status ${isolatedSchema}.project_status NOT NULL DEFAULT 'planning',
        description text,
        pattern_name text,
        pattern_designer text,
        designer_website text,
        designer_page_title text,
        yarn text,
        yarn_brand text,
        yarn_type text,
        yarn_color text,
        tools text,
        hook_size text,
        started_at date,
        started_at_precision ${isolatedSchema}.project_date_precision NOT NULL DEFAULT 'day',
        target_date date,
        target_date_precision ${isolatedSchema}.project_date_precision NOT NULL DEFAULT 'day',
        completed_at date,
        completed_at_precision ${isolatedSchema}.project_date_precision NOT NULL DEFAULT 'day',
        completion_percent integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ${isolatedSchema}.project_progress_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES ${isolatedSchema}.projects(id) ON DELETE CASCADE,
        notes text NOT NULL,
        photo_path text,
        completion_percent integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ${isolatedSchema}.stars (
        user_id text NOT NULL REFERENCES ${isolatedSchema}.users(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES ${isolatedSchema}.projects(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, project_id)
      );
    `);

    testPool = new pg.Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${schemaName}`,
    });
    const { rows: pathRows } = await testPool.query<{ schema_name: string }>(
      "SELECT current_schema() AS schema_name",
    );
    if (pathRows[0]?.schema_name !== schemaName) {
      throw new Error("PostgreSQL test connection did not select its isolated schema.");
    }

    testDb = drizzle(testPool, { schema });
    vi.doMock("@workspace/db", async () => ({
      ...schema,
      db: getTestDb(),
    }));
    const { default: projectsRouter } = await import("./projects");
    const app = express();
    app.use(express.json());
    app.use(projectsRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("PostgreSQL authorization test server did not start.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    const timestamp = new Date("2026-10-13T12:00:00.000Z");
    await getTestDb().insert(usersTable).values([
      { id: ownerA, email: "a@example.test" },
      { id: ownerB, email: "b@example.test" },
    ]);
    await getTestDb().insert(projectsTable).values([
      {
        id: projectAId,
        ownerId: ownerA,
        title: "A's sweater",
        craft: "knitting",
        status: "in_progress",
        completionPercent: 25,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: projectBId,
        ownerId: ownerB,
        title: "B's blanket",
        craft: "crochet",
        status: "in_progress",
        completionPercent: 50,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    await getTestDb().insert(progressEntriesTable).values([
      {
        id: progressAId,
        projectId: projectAId,
        notes: "A's private progress",
        photoPath: `/objects/progress/${projectAId}/photo-a`,
        completionPercent: 25,
        createdAt: timestamp,
      },
      {
        id: progressBId,
        projectId: projectBId,
        notes: "B's private progress",
        photoPath: `/objects/progress/${projectBId}/photo-b`,
        completionPercent: 50,
        createdAt: timestamp,
      },
    ]);
  }, 30_000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server?.close((error) => error ? reject(error) : resolve()),
      );
    }
    await testPool?.end();
    if (schemaCreated && schemaName && adminPool) {
      await adminPool.query(`DROP SCHEMA ${quoteIsolatedSchema(schemaName)} CASCADE`);
      schemaCreated = false;
      const { rowCount } = await adminPool.query(
        "SELECT 1 FROM pg_namespace WHERE nspname = $1",
        [schemaName],
      );
      expect(rowCount).toBe(0);
    }
    await adminPool?.end();
  });

  it("limits project lists and details to the signed-in owner", async () => {
    const listResponse = await request("/projects", { user: ownerA });
    expect(listResponse.status).toBe(200);
    expect(((await listResponse.json()) as { id: string }[]).map(({ id }) => id)).toEqual([
      projectAId,
    ]);

    const otherListResponse = await request("/projects", { user: ownerB });
    expect(otherListResponse.status).toBe(200);
    expect(((await otherListResponse.json()) as { id: string }[]).map(({ id }) => id)).toEqual([
      projectBId,
    ]);

    const forbiddenDetail = await request(`/projects/${projectAId}`, { user: ownerB });
    expect(forbiddenDetail.status).toBe(404);
    const ownDetail = await request(`/projects/${projectAId}`, { user: ownerA });
    expect(ownDetail.status).toBe(200);
    const detail = await ownDetail.json() as {
      progress: { id: string; notes: string }[];
    };
    expect(detail.progress).toEqual([
      expect.objectContaining({ id: progressAId, notes: "A's private progress" }),
    ]);
    expect(JSON.stringify(detail)).not.toContain("B's");
  });

  it("prevents cross-owner updates and deletes from changing either project", async () => {
    const updateResponse = await request(`/projects/${projectAId}`, {
      method: "PATCH",
      user: ownerB,
      body: { title: "Hijacked title" },
    });
    expect(updateResponse.status).toBe(404);

    const deleteResponse = await request(`/projects/${projectAId}`, {
      method: "DELETE",
      user: ownerB,
    });
    expect(deleteResponse.status).toBe(404);

    const rows = await getTestDb()
      .select({ id: projectsTable.id, ownerId: projectsTable.ownerId, title: projectsTable.title })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectAId));
    expect(rows).toEqual([
      { id: projectAId, ownerId: ownerA, title: "A's sweater" },
    ]);
    const progress = await getTestDb()
      .select({ id: progressEntriesTable.id })
      .from(progressEntriesTable)
      .where(eq(progressEntriesTable.projectId, projectAId));
    expect(progress).toEqual([{ id: progressAId }]);
  });

  it("prevents cross-owner progress writes and scopes dashboard data", async () => {
    const progressResponse = await request(`/projects/${projectAId}/progress`, {
      method: "POST",
      user: ownerB,
      body: { notes: "Unauthorized progress", completionPercent: 75 },
    });
    expect(progressResponse.status).toBe(404);

    const entries = await getTestDb()
      .select({ id: progressEntriesTable.id })
      .from(progressEntriesTable)
      .where(eq(progressEntriesTable.projectId, projectAId));
    expect(entries).toEqual([{ id: progressAId }]);

    const dashboardResponse = await request("/dashboard", { user: ownerA });
    expect(dashboardResponse.status).toBe(200);
    const dashboard = await dashboardResponse.json() as {
      totalProjects: number;
      activeProjects: number;
      completedProjects: number;
      recentProjects: { id: string }[];
      recentProgress: { projectId: string; notes: string }[];
      charts: {
        projectsByStatus: { status: string; count: number }[];
        progressPerWeek: { count: number }[];
      };
    };
    expect(dashboard.charts.projectsByStatus).toContainEqual({ status: "in_progress", count: 1 });
    expect(
      dashboard.charts.projectsByStatus.reduce((sum, item) => sum + item.count, 0),
    ).toBe(1);
    expect(
      dashboard.charts.progressPerWeek.reduce((sum, week) => sum + week.count, 0),
    ).toBe(1);
    expect(dashboard.totalProjects).toBe(1);
    expect(dashboard.activeProjects).toBe(1);
    expect(dashboard.completedProjects).toBe(0);
    expect(dashboard.recentProjects.map(({ id }) => id)).toEqual([projectAId]);
    expect(dashboard.recentProgress).toEqual([
      expect.objectContaining({ projectId: projectAId, notes: "A's private progress" }),
    ]);
    expect(JSON.stringify(dashboard)).not.toContain("B's");
  });
});
