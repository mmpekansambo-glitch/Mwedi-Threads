import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { sewingProjectsTable, usersTable } from "@workspace/db/schema";
import { sewingProjectEntriesSql, sewingProjectMachineSettingsSql, sewingProjectToolsSql, sewingTablesSql, sewingToolsSql, stashTablesSql } from "../test/stashTablesSql";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const ownerA = "patterns-test-user-a";
const ownerB = "patterns-test-user-b";
// Never loads the Sewing room before its old projects are added.
const ownerC = "patterns-test-user-c";
const photo = (owner: string) => `/objects/sewing-patterns/${owner}/${randomUUID()}`;

let schemaName: string | undefined;
let schemaCreated = false;
let adminPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;
let server: ReturnType<express.Express["listen"]> | undefined;
let baseUrl: string;
const deletedPhotos: string[] = [];

function quoteIsolatedSchema(name: string): string {
  if (!/^patterns_test_[0-9]+_[0-9a-f]+$/.test(name)) {
    throw new Error("Refusing to use an unexpected PostgreSQL test schema name.");
  }
  return `"${name}"`;
}

function getTestDb() {
  if (!testDb) throw new Error("PostgreSQL test database was not initialized.");
  return testDb;
}

// Test responses are checked field by field, so they are read loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function read(response: Response): Promise<any> {
  return response.json();
}

async function request(
  path: string,
  options: { method?: string; user?: string; body?: unknown } = {},
) {
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    redirect: "manual",
    headers: {
      ...(options.user ? { "x-test-user": options.user } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}

describe.skipIf(!databaseUrl)("sewing patterns against PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PostgreSQL patterns tests cannot run in production.");
    }
    adminPool = new pg.Pool({ connectionString: databaseUrl });
    const { rows } = await adminPool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
      throw new Error("Refusing to run PostgreSQL patterns tests against a production database.");
    }

    schemaName = `patterns_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
    const isolatedSchema = quoteIsolatedSchema(schemaName);
    await adminPool.query(`CREATE SCHEMA ${isolatedSchema}`);
    schemaCreated = true;
    await adminPool.query(`
      CREATE TABLE ${isolatedSchema}.users (
        id text PRIMARY KEY,
        email text,
        display_name text,
        joined_at timestamptz NOT NULL DEFAULT now(),
        yarn_enabled boolean NOT NULL DEFAULT true,
        sewing_enabled boolean NOT NULL DEFAULT false,
        crafts_chosen_at timestamptz,
        currency text NOT NULL DEFAULT 'USD',
        yarn_weekly_goal integer,
        sewing_weekly_goal integer
      );
      CREATE TABLE ${isolatedSchema}.projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id text REFERENCES ${isolatedSchema}.users(id)
      );
      CREATE TYPE ${isolatedSchema}.project_status AS ENUM ('planning', 'in_progress', 'paused', 'completed');
      ${stashTablesSql(isolatedSchema)}
      ${sewingTablesSql(isolatedSchema)}
      ${sewingToolsSql(isolatedSchema)}
      ${sewingProjectToolsSql(isolatedSchema)}
      ${sewingProjectEntriesSql(isolatedSchema)}
      ${sewingProjectMachineSettingsSql(isolatedSchema)}
    `);

    testPool = new pg.Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${schemaName}`,
    });
    testDb = drizzle(testPool, { schema });
    vi.doMock("@workspace/db", async () => ({
      ...schema,
      db: getTestDb(),
    }));
    vi.doMock("../lib/objectStorage", () => ({
      deleteStoredObject: async (path: string) => { deletedPhotos.push(path); },
      signedObjectUrl: async () => "https://storage.test/signed",
      storageLocation: () => ({ bucketName: "bucket", objectName: "object" }),
    }));
    const { default: sewingPatternsRouter } = await import("./sewingPatterns");
    const { default: sewingProjectsRouter } = await import("./sewingProjects");
    const app = express();
    app.use(express.json());
    app.use(sewingPatternsRouter);
    app.use(sewingProjectsRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("PostgreSQL patterns test server did not start.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    await getTestDb().insert(usersTable).values([
      { id: ownerA, email: "a@example.test" },
      { id: ownerB, email: "b@example.test" },
      { id: ownerC, email: "c@example.test" },
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await testPool?.end();
    if (schemaCreated && schemaName) {
      await adminPool?.query(`DROP SCHEMA ${quoteIsolatedSchema(schemaName)} CASCADE`);
    }
    await adminPool?.end();
  });

  async function addPattern(owner: string, body: Record<string, unknown> = {}) {
    return request("/sewing-patterns", {
      method: "POST",
      user: owner,
      body: { name: "Wrap dress", ...body },
    });
  }

  it("adds patterns for their owner only, with an optional photo", async () => {
    const created = await addPattern(ownerA, {
      name: "  Wrap dress ", designer: "Closet Core", patternType: "dress", format: "pdf", sizes: "0-20", photoPath: photo(ownerA),
    });
    expect(created.status).toBe(201);
    const dress = await read(created);
    expect(dress).toMatchObject({ name: "Wrap dress", designer: "Closet Core", patternType: "dress", format: "pdf", sizes: "0-20", hasPhoto: true, timesMade: 0 });
    expect(dress.ownerId).toBeUndefined();
    expect(dress.photoPath).toBeUndefined();
    expect((await addPattern(ownerA, { name: "Tote bag" })).status).toBe(201);

    expect((await addPattern(ownerA, { name: "   " })).status).toBe(400);
    expect((await addPattern(ownerA, { photoPath: photo(ownerB) })).status).toBe(400);

    const mine = await read(await request("/sewing-patterns", { user: ownerA }));
    expect(mine.map((pattern: { name: string }) => pattern.name)).toEqual(["Tote bag", "Wrap dress"]);
    expect(await read(await request("/sewing-patterns", { user: ownerB }))).toEqual([]);
    expect((await request(`/sewing-patterns/${dress.id}`, { user: ownerB })).status).toBe(404);
    const pdfs = await read(await request("/sewing-patterns?format=pdf", { user: ownerA }));
    expect(pdfs.map((pattern: { name: string }) => pattern.name)).toEqual(["Wrap dress"]);
    const searched = await read(await request("/sewing-patterns?search=closet", { user: ownerA }));
    expect(searched.map((pattern: { name: string }) => pattern.name)).toEqual(["Wrap dress"]);
  });

  it("edits a pattern and removes its old photo", async () => {
    const pattern = await read(await addPattern(ownerA, { name: "Shirt", photoPath: photo(ownerA) }));
    const updated = await request(`/sewing-patterns/${pattern.id}`, {
      method: "PATCH", user: ownerA, body: { designer: "Maker Example", format: "paper", photoPath: null },
    });
    expect(updated.status).toBe(200);
    expect(await read(updated)).toMatchObject({ name: "Shirt", designer: "Maker Example", format: "paper", hasPhoto: false });
    expect(deletedPhotos.length).toBeGreaterThan(0);
    expect((await request(`/sewing-patterns/${pattern.id}`, { method: "PATCH", user: ownerB, body: { name: "Mine" } })).status).toBe(404);
  });

  it("links projects to stash patterns and counts finished ones as made", async () => {
    const pattern = await read(await addPattern(ownerA, { name: "Camp shirt", designer: "Maker Example" }));
    const first = await request("/sewing-projects", {
      method: "POST", user: ownerA, body: { title: "Linen shirt", patternId: pattern.id, status: "completed" },
    });
    expect(first.status).toBe(201);
    expect(await read(first)).toMatchObject({ patternId: pattern.id, patternName: "Camp shirt", patternDesigner: "Maker Example" });
    await request("/sewing-projects", { method: "POST", user: ownerA, body: { title: "Second shirt", patternId: pattern.id } });

    const counted = await read(await request(`/sewing-patterns/${pattern.id}`, { user: ownerA }));
    expect(counted.timesMade).toBe(1);

    // A typed name finds the matching stash pattern instead of adding a copy.
    const typed = await read(await request("/sewing-projects", {
      method: "POST", user: ownerA, body: { title: "Third shirt", patternName: "camp  SHIRT", patternDesigner: "maker example" },
    }));
    expect(typed.patternId).toBe(pattern.id);
    // A new typed name is added to the stash.
    const added = await read(await request("/sewing-projects", {
      method: "POST", user: ownerA, body: { title: "Apron", patternName: "Cross-back apron" },
    }));
    expect(added.patternId).toBeTruthy();
    const names = (await read(await request("/sewing-patterns", { user: ownerA }))).map((item: { name: string }) => item.name);
    expect(names).toContain("Cross-back apron");
    expect(names.filter((name: string) => name === "Camp shirt")).toHaveLength(1);

    // Another maker's pattern can't be used.
    expect((await request("/sewing-projects", { method: "POST", user: ownerB, body: { title: "Mine", patternId: pattern.id } })).status).toBe(400);

    // Projects can be found by their pattern's name.
    const found = await read(await request("/sewing-projects?search=apron", { user: ownerA }));
    expect(found.map((project: { title: string }) => project.title)).toEqual(["Apron"]);

    // Clearing the pattern, then deleting a pattern leaves its projects with none.
    const cleared = await read(await request(`/sewing-projects/${added.id}`, { method: "PATCH", user: ownerA, body: { patternId: null, patternName: null } }));
    expect(cleared).toMatchObject({ patternId: null, patternName: null });
    expect((await request(`/sewing-patterns/${pattern.id}`, { method: "DELETE", user: ownerA })).status).toBe(204);
    const after = await read(await request(`/sewing-projects/${typed.id}`, { user: ownerA }));
    expect(after).toMatchObject({ patternId: null, patternName: null });
  });

  it("moves typed patterns from before the stash into it", async () => {
    await getTestDb().insert(sewingProjectsTable).values([
      { ownerId: ownerC, title: "Old dress", patternName: "Sundress", patternDesigner: "Maker Example", status: "completed" },
      { ownerId: ownerC, title: "Old dress again", patternName: " sundress ", patternDesigner: "Maker example" },
    ]);
    const patterns = await read(await request("/sewing-patterns", { user: ownerC }));
    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({ name: "Sundress", designer: "Maker Example", timesMade: 1 });
    const projects = await read(await request("/sewing-projects", { user: ownerC }));
    expect(projects.every((project: { patternId: string }) => project.patternId === patterns[0].id)).toBe(true);
    expect(projects.every((project: { patternName: string }) => project.patternName === "Sundress")).toBe(true);
  });
});
