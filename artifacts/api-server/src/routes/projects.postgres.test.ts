import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { progressEntriesTable, projectsTable, usersTable } from "@workspace/db/schema";
import { stashTablesSql } from "../test/stashTablesSql";

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
      CREATE TYPE ${isolatedSchema}.progress_method AS ENUM ('estimate', 'rows', 'sections', 'skeins');
      CREATE TABLE ${isolatedSchema}.users (
        id text PRIMARY KEY,
        email text,
        display_name text,
        joined_at timestamptz NOT NULL DEFAULT now(),
        yarn_enabled boolean NOT NULL DEFAULT true,
        sewing_enabled boolean NOT NULL DEFAULT false,
        crafts_chosen_at timestamptz
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
        second_hook_size text,
        needle_size text,
        needle_type text,
        needle_cable_length text,
        second_needle_size text,
        second_needle_type text,
        second_needle_cable_length text,
        started_at date,
        started_at_precision ${isolatedSchema}.project_date_precision NOT NULL DEFAULT 'day',
        target_date date,
        target_date_precision ${isolatedSchema}.project_date_precision NOT NULL DEFAULT 'day',
        completed_at date,
        completed_at_precision ${isolatedSchema}.project_date_precision NOT NULL DEFAULT 'day',
        progress_method ${isolatedSchema}.progress_method NOT NULL DEFAULT 'estimate',
        progress_total double precision,
        progress_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
        completion_percent integer NOT NULL DEFAULT 0,
        counter integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ${isolatedSchema}.project_progress_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES ${isolatedSchema}.projects(id) ON DELETE CASCADE,
        notes text NOT NULL,
        photo_path text,
        completion_percent integer NOT NULL,
        progress_value double precision,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE ${isolatedSchema}.stars (
        user_id text NOT NULL REFERENCES ${isolatedSchema}.users(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES ${isolatedSchema}.projects(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, project_id)
      );
      ${stashTablesSql(isolatedSchema)}
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

  it("works out progress from each project's tracking method", async () => {
    const createResponse = await request("/projects", {
      method: "POST",
      user: ownerA,
      body: { title: "Raglan", craft: "knitting", progressMethod: "rows", progressTotal: 200 },
    });
    expect(createResponse.status).toBe(201);
    const project = await createResponse.json() as { id: string; progressMethod: string; progressTotal: number };
    expect(project).toMatchObject({ progressMethod: "rows", progressTotal: 200 });

    const missingRow = await request(`/projects/${project.id}/progress`, {
      method: "POST",
      user: ownerA,
      body: { notes: "No row given", completionPercent: 90 },
    });
    expect(missingRow.status).toBe(400);

    const rowNote = await request(`/projects/${project.id}/progress`, {
      method: "POST",
      user: ownerA,
      body: { notes: "Finished the yoke", progressValue: 50 },
    });
    expect(rowNote.status).toBe(201);
    expect(await rowNote.json()).toMatchObject({ completionPercent: 25, progressValue: 50 });

    const noSections = await request(`/projects/${project.id}`, {
      method: "PATCH",
      user: ownerA,
      body: { progressMethod: "sections" },
    });
    expect(noSections.status).toBe(400);

    const switched = await request(`/projects/${project.id}`, {
      method: "PATCH",
      user: ownerA,
      body: {
        progressMethod: "sections",
        progressSections: [{ name: "Body", done: false }, { name: "Sleeves", done: false }],
      },
    });
    expect(switched.status).toBe(200);
    expect(await switched.json()).toMatchObject({ progressMethod: "sections", completionPercent: 25 });

    const sectionNote = await request(`/projects/${project.id}/progress`, {
      method: "POST",
      user: ownerA,
      body: { notes: "Both done", sectionsDone: [0, 1] },
    });
    expect(sectionNote.status).toBe(201);

    const detail = await (await request(`/projects/${project.id}`, { user: ownerA })).json() as {
      status: string;
      completionPercent: number;
      progressSections: { name: string; done: boolean }[];
    };
    expect(detail).toMatchObject({
      status: "completed",
      completionPercent: 100,
      progressSections: [{ name: "Body", done: true }, { name: "Sleeves", done: true }],
    });
  });

  it("moves an old project's yarn into its yarn list and finds projects by any yarn", async () => {
    const ownerC = "postgres-test-user-c";
    await getTestDb().insert(usersTable).values({ id: ownerC, email: "c@example.test" });
    const [old] = await getTestDb()
      .insert(projectsTable)
      .values({ ownerId: ownerC, title: "Old blanket", craft: "crochet", yarnBrand: "Malabrigo", yarnType: "Merino worsted", yarnColor: "Teal" })
      .returning();

    const search = async (term: string, user = ownerC) => {
      const response = await request(`/projects?search=${encodeURIComponent(term)}`, { user });
      expect(response.status).toBe(200);
      return ((await response.json()) as { id: string }[]).map(({ id }) => id);
    };

    expect(await search("malabrigo")).toEqual([old.id]);
    expect(await search("merino")).toEqual([old.id]);
    expect(await search("teal")).toEqual([old.id]);
    expect(await search("cotton")).toEqual([]);
    expect(await search("malabrigo", ownerB)).toEqual([]);
    const [moved] = await getTestDb().select().from(projectsTable).where(eq(projectsTable.id, old.id));
    expect(moved).toMatchObject({ yarnBrand: null, yarnType: null, yarnColor: null });

    const detail = await (await request(`/projects/${old.id}`, { user: ownerC })).json() as { yarns: unknown[] };
    expect(detail.yarns).toMatchObject([
      { brand: "Malabrigo", subBrand: "Merino worsted", color: "Teal", stashYarnId: expect.any(String), heldTogether: false },
    ]);

    const updated = await request(`/projects/${old.id}`, {
      method: "PATCH",
      user: ownerC,
      body: { yarns: [...detail.yarns, { brand: "Knit Picks", subBrand: "Brava", color: "Cotton Candy", heldTogether: true }] },
    });
    expect(updated.status).toBe(200);
    expect(await search("cotton candy")).toEqual([old.id]);
  });

  it("saves the counter for the owner only and leaves progress alone", async () => {
    const before = await getTestDb()
      .select({ percent: projectsTable.completionPercent, updatedAt: projectsTable.updatedAt })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectAId));

    const saved = await request(`/projects/${projectAId}/counter`, {
      method: "PUT",
      user: ownerA,
      body: { count: 37 },
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ count: 37 });

    const detail = await request(`/projects/${projectAId}`, { user: ownerA });
    expect(((await detail.json()) as { counter: number }).counter).toBe(37);

    const after = await getTestDb()
      .select({ percent: projectsTable.completionPercent, updatedAt: projectsTable.updatedAt })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectAId));
    expect(after).toEqual(before);

    const otherOwner = await request(`/projects/${projectAId}/counter`, {
      method: "PUT",
      user: ownerB,
      body: { count: 1 },
    });
    expect(otherOwner.status).toBe(404);

    const negative = await request(`/projects/${projectAId}/counter`, {
      method: "PUT",
      user: ownerA,
      body: { count: -1 },
    });
    expect(negative.status).toBe(400);
  });
});
