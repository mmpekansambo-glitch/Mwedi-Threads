import { eq } from "drizzle-orm";
import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { sewingToolsTable, usersTable } from "@workspace/db/schema";
import { sewingProjectEntriesSql, sewingProjectToolsSql, sewingTablesSql, sewingToolsSql, stashTablesSql } from "../test/stashTablesSql";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const ownerA = "sewing-test-user-a";
const ownerB = "sewing-test-user-b";
const photo = (owner: string) => `/objects/fabric/${owner}/${randomUUID()}`;

let schemaName: string | undefined;
let schemaCreated = false;
let adminPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;
let server: ReturnType<express.Express["listen"]> | undefined;
let baseUrl: string;
const deletedPhotos: string[] = [];

function quoteIsolatedSchema(name: string): string {
  if (!/^sewing_test_[0-9]+_[0-9a-f]+$/.test(name)) {
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

describe.skipIf(!databaseUrl)("sewing projects against PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PostgreSQL sewing tests cannot run in production.");
    }
    adminPool = new pg.Pool({ connectionString: databaseUrl });
    const { rows } = await adminPool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
      throw new Error("Refusing to run PostgreSQL sewing tests against a production database.");
    }

    schemaName = `sewing_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
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
        crafts_chosen_at timestamptz
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
    const { default: fabricStashRouter } = await import("./fabricStash");
    const { default: sewingProjectsRouter } = await import("./sewingProjects");
    const app = express();
    app.use(express.json());
    app.use(fabricStashRouter);
    app.use(sewingProjectsRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("PostgreSQL sewing test server did not start.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    await getTestDb().insert(usersTable).values([
      { id: ownerA, email: "a@example.test" },
      { id: ownerB, email: "b@example.test" },
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

  async function addFabric(owner: string, body: Record<string, unknown> = {}) {
    return read(await request("/fabric-stash", {
      method: "POST",
      user: owner,
      body: { fabricType: "linen", unit: "meters", amount: 3, photoPaths: [photo(owner)], ...body },
    }));
  }

  it("creates a project with stash fabric for its owner only", async () => {
    const linen = await addFabric(ownerA);
    const created = await request("/sewing-projects", {
      method: "POST",
      user: ownerA,
      body: {
        title: "  Summer dress ", patternName: "Wrap dress", patternDesigner: "Maker Example",
        sizeMade: "12", fitChanges: "Lengthened the bodice 2 cm",
        fabrics: [{ stashFabricId: linen.id, amountUsed: 2.255 }],
      },
    });
    expect(created.status).toBe(201);
    const project = await read(created);
    expect(project).toMatchObject({
      title: "Summer dress", status: "planning", stage: "prep", sizeMade: "12", completedAt: null,
      fabrics: [{ stashFabricId: linen.id, amountUsed: 2.26, fabric: { id: linen.id, photoCount: 1 } }],
    });
    expect(project.ownerId).toBeUndefined();
    expect(project.fabrics[0].fabric.photoPaths).toBeUndefined();

    expect(await read(await request("/sewing-projects", { user: ownerA }))).toHaveLength(1);
    expect(await read(await request("/sewing-projects", { user: ownerB }))).toHaveLength(0);
    expect(await read(await request("/sewing-projects?search=wrap", { user: ownerA }))).toHaveLength(1);
    expect(await read(await request("/sewing-projects?status=completed", { user: ownerA }))).toHaveLength(0);
    expect((await request(`/sewing-projects/${project.id}`, { user: ownerB })).status).toBe(404);
  });

  it("only uses fabric from the maker's own stash, once each", async () => {
    const theirs = await addFabric(ownerB);
    const someoneElses = await request("/sewing-projects", {
      method: "POST", user: ownerA, body: { title: "Skirt", fabrics: [{ stashFabricId: theirs.id }] },
    });
    expect(someoneElses.status).toBe(400);
    expect((await read(someoneElses)).error).toBe("Choose fabric from your stash.");

    const mine = await addFabric(ownerA);
    const twice = await request("/sewing-projects", {
      method: "POST", user: ownerA, body: { title: "Skirt", fabrics: [{ stashFabricId: mine.id }, { stashFabricId: mine.id }] },
    });
    expect(twice.status).toBe(400);
    expect((await request("/sewing-projects", { method: "POST", user: ownerA, body: { title: "   " } })).status).toBe(400);
  });

  it("moves through stages, dates a finished project and clears the date on reopening", async () => {
    const cotton = await addFabric(ownerA, { fabricType: "cotton" });
    const project = await read(await request("/sewing-projects", {
      method: "POST", user: ownerA, body: { title: "Shirt", status: "in_progress", fabrics: [{ stashFabricId: cotton.id }] },
    }));
    const cut = await read(await request(`/sewing-projects/${project.id}`, { method: "PATCH", user: ownerA, body: { stage: "cut" } }));
    expect(cut).toMatchObject({ stage: "cut", status: "in_progress" });

    const finished = await read(await request(`/sewing-projects/${project.id}`, { method: "PATCH", user: ownerA, body: { status: "completed" } }));
    expect(finished.stage).toBe("finish");
    expect(finished.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(finished.fabrics).toHaveLength(1);

    const reopened = await read(await request(`/sewing-projects/${project.id}`, { method: "PATCH", user: ownerA, body: { status: "in_progress", fabrics: [] } }));
    expect(reopened).toMatchObject({ completedAt: null, fabrics: [] });
  });

  it("drops a fabric from projects when it leaves the stash, and deletes projects", async () => {
    const silk = await addFabric(ownerB, { fabricType: "silk" });
    const project = await read(await request("/sewing-projects", {
      method: "POST", user: ownerB, body: { title: "Scarf", fabrics: [{ stashFabricId: silk.id, amountUsed: 1 }] },
    }));
    await request(`/fabric-stash/${silk.id}`, { method: "DELETE", user: ownerB });
    expect((await read(await request(`/sewing-projects/${project.id}`, { user: ownerB }))).fabrics).toEqual([]);

    expect((await request(`/sewing-projects/${project.id}`, { method: "DELETE", user: ownerA })).status).toBe(404);
    expect((await request(`/sewing-projects/${project.id}`, { method: "DELETE", user: ownerB })).status).toBe(204);
    expect((await request(`/sewing-projects/${project.id}`, { user: ownerB })).status).toBe(404);
  });

  it("keeps the needle, thread color and the maker's own tools on a project", async () => {
    const [zip, foot, theirs] = await getTestDb()
      .insert(sewingToolsTable)
      .values([
        { ownerId: ownerA, section: "notions", category: "zip", name: "Invisible zip" },
        { ownerId: ownerA, section: "kit", category: "presser_foot", name: "Walking foot" },
        { ownerId: ownerB, section: "notions", category: "button", name: "Shell buttons" },
      ])
      .returning();
    const created = await request("/sewing-projects", {
      method: "POST",
      user: ownerA,
      body: { title: "Tee", needleType: "stretch", needleSize: "75/11", threadColor: "blue", toolIds: [foot!.id, zip!.id] },
    });
    expect(created.status).toBe(201);
    const project = await read(created);
    expect(project).toMatchObject({ needleType: "stretch", needleSize: "75/11", threadColor: "blue" });
    expect(project.tools.map((tool: { name: string }) => tool.name)).toEqual(["Walking foot", "Invisible zip"]);
    expect(project.tools[0].photoPath).toBeUndefined();

    const notMine = await request(`/sewing-projects/${project.id}`, { method: "PATCH", user: ownerA, body: { toolIds: [theirs!.id] } });
    expect((await read(notMine)).error).toBe("Choose tools from your Sewing room.");
    expect((await request(`/sewing-projects/${project.id}`, { method: "PATCH", user: ownerA, body: { toolIds: [zip!.id, zip!.id] } })).status).toBe(400);
    expect((await request("/sewing-projects", { method: "POST", user: ownerA, body: { title: "Tee", needleSize: "75" } })).status).toBe(400);

    const cleared = await read(await request(`/sewing-projects/${project.id}`, {
      method: "PATCH", user: ownerA, body: { needleType: null, threadColor: null, toolIds: [zip!.id] },
    }));
    expect(cleared).toMatchObject({ needleType: null, needleSize: "75/11", threadColor: null });
    expect(cleared.tools.map((tool: { id: string }) => tool.id)).toEqual([zip!.id]);

    // A tool that leaves the Sewing room leaves the project too.
    await getTestDb().delete(sewingToolsTable).where(eq(sewingToolsTable.id, zip!.id));
    expect((await read(await request(`/sewing-projects/${project.id}`, { user: ownerA }))).tools).toEqual([]);
    await request(`/sewing-projects/${project.id}`, { method: "DELETE", user: ownerA });
  });

  it("keeps whether a fabric is pre-washed", async () => {
    const washed = await addFabric(ownerB, { preWashed: true });
    expect(washed.preWashed).toBe(true);
    expect((await addFabric(ownerB)).preWashed).toBeNull();
    const changed = await read(await request(`/fabric-stash/${washed.id}`, { method: "PATCH", user: ownerB, body: { preWashed: false } }));
    expect(changed.preWashed).toBe(false);
  });

  it("keeps a dated notes journal on a project for its owner only", async () => {
    const project = await read(await request("/sewing-projects", { method: "POST", user: ownerB, body: { title: "Coat" } }));
    expect(project.entries).toEqual([]);
    const notes = `/sewing-projects/${project.id}/entries`;
    const first = await read(await request(notes, { method: "POST", user: ownerB, body: { notes: " Cut the lining ", createdAt: "2026-10-01T12:00:00.000Z" } }));
    expect(first).toMatchObject({ notes: "Cut the lining", createdAt: "2026-10-01T12:00:00.000Z" });
    expect(first.projectId).toBeUndefined();
    const second = await read(await request(notes, { method: "POST", user: ownerB, body: { notes: "Sewed the sleeves" } }));
    expect((await read(await request(`/sewing-projects/${project.id}`, { user: ownerB }))).entries.map((entry: { id: string }) => entry.id)).toEqual([second.id, first.id]);

    expect((await request(notes, { method: "POST", user: ownerB, body: { notes: "   " } })).status).toBe(400);
    expect((await request(notes, { method: "POST", user: ownerB, body: { notes: "Later", createdAt: "2099-01-01T00:00:00.000Z" } })).status).toBe(400);
    expect((await request(notes, { method: "POST", user: ownerA, body: { notes: "Not mine" } })).status).toBe(404);

    const edited = await read(await request(`${notes}/${first.id}`, { method: "PATCH", user: ownerB, body: { notes: "Cut the lining and interfacing" } }));
    expect(edited).toMatchObject({ notes: "Cut the lining and interfacing", createdAt: "2026-10-01T12:00:00.000Z" });
    expect((await request(`${notes}/${first.id}`, { method: "PATCH", user: ownerA, body: { notes: "Mine now" } })).status).toBe(404);
    expect((await request(`${notes}/${first.id}`, { method: "DELETE", user: ownerA })).status).toBe(404);
    expect((await request(`${notes}/${first.id}`, { method: "DELETE", user: ownerB })).status).toBe(204);
    expect((await read(await request(`/sewing-projects/${project.id}`, { user: ownerB }))).entries).toHaveLength(1);
    expect((await request(`/sewing-projects/${project.id}`, { method: "DELETE", user: ownerB })).status).toBe(204);
  });

  it("leaves fabric in the Archive out of the Overview's stash counts", async () => {
    const plain = await addFabric(ownerB, { fabricType: "denim" });
    const before = await read(await request("/sewing-overview", { user: ownerB }));
    await request(`/fabric-stash/${plain.id}`, { method: "PATCH", user: ownerB, body: { archived: true } });
    const after = await read(await request("/sewing-overview", { user: ownerB }));
    expect(after.fabricPieces).toBe(before.fabricPieces - 1);
    expect(after.fabricLength).toBe(before.fabricLength - 3);
  });

  it("sums up the Sewing room for the Overview", async () => {
    const overview = await read(await request("/sewing-overview", { user: ownerA }));
    // ownerA has the dress (planning), the reopened shirt (in progress, still at Finish) and three 3 m pieces.
    expect(overview).toMatchObject({
      inProgress: 1,
      finished: 0,
      fabricPieces: 3,
      fabricLength: 9,
      fabricUnit: "meters",
    });
    expect(overview.stages.map((entry: { stage: string }) => entry.stage)).toEqual(["prep", "cut", "sew", "fit", "finish"]);
    expect(overview.stages.map((entry: { count: number }) => entry.count)).toEqual([0, 0, 0, 0, 1]);
    expect(overview.fabricTypes).toEqual([{ fabricType: "linen", count: 2 }, { fabricType: "cotton", count: 1 }]);
    expect(overview.recentProjects[0].title).toBe("Shirt");
    expect((await request("/sewing-overview")).status).toBe(401);
  });
});
