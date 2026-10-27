import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { stashYarnsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { stashTablesSql } from "../test/stashTablesSql";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const maker = "links-test-maker";
const otherMaker = "links-test-other";
const reviewer = "links-test-reviewer";
const earlyMaker = "links-test-early";

let schemaName: string | undefined;
let schemaCreated = false;
let adminPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;
let server: ReturnType<express.Express["listen"]> | undefined;
let baseUrl: string;

function quoteIsolatedSchema(name: string): string {
  if (!/^links_test_[0-9]+_[0-9a-f]+$/.test(name)) {
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
    headers: {
      ...(options.user ? { "x-test-user": options.user } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}

async function createProject(user: string, body: object) {
  const response = await request("/projects", {
    method: "POST",
    user,
    body: { title: "Striped blanket", craft: "crochet", ...body },
  });
  return { status: response.status, body: await read(response) };
}

describe.skipIf(!databaseUrl)("project yarn, stash links and catalog reviews against PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PostgreSQL tests cannot run in production.");
    }
    adminPool = new pg.Pool({ connectionString: databaseUrl });
    const { rows } = await adminPool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
      throw new Error("Refusing to run PostgreSQL tests against a production database.");
    }

    schemaName = `links_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
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
    testDb = drizzle(testPool, { schema });
    vi.doMock("@workspace/db", async () => ({
      ...schema,
      db: getTestDb(),
    }));
    vi.doMock("../lib/objectStorage", () => ({
      deleteStoredObject: async () => undefined,
      signedObjectUrl: async () => "https://storage.test/signed",
      storageLocation: () => ({ bucketName: "bucket", objectName: "object" }),
    }));
    process.env.CATALOG_REVIEWER_EMAILS = "someone@example.test, Reviewer@Example.test";
    const { default: routes } = await import("./index");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).log = { debug: () => undefined, error: () => undefined, warn: () => undefined };
      next();
    });
    app.use(routes);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("PostgreSQL test server did not start.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    await getTestDb().insert(usersTable).values([
      { id: maker, email: "maker@example.test", displayName: "Maker" },
      { id: otherMaker, email: "other@example.test" },
      { id: reviewer, email: "reviewer@example.test" },
      { id: earlyMaker, email: "early@example.test" },
    ]);
  });

  afterAll(async () => {
    delete process.env.CATALOG_REVIEWER_EMAILS;
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await testPool?.end();
    if (schemaCreated && schemaName) {
      await adminPool?.query(`DROP SCHEMA ${quoteIsolatedSchema(schemaName)} CASCADE`);
    }
    await adminPool?.end();
  });

  it("adds new project yarn to the stash and links the same yarn again", async () => {
    const first = await createProject(maker, {
      yarns: [
        { brand: "Lion Brand", subBrand: "Wool-Ease", color: "Fisherman" },
        { brand: "Lion Brand", subBrand: "Wool-Ease", color: "Cranberry", heldTogether: true },
        { brand: "", subBrand: " ", color: null },
      ],
    });
    expect(first.status).toBe(201);
    expect(first.body.yarns).toHaveLength(2);
    expect(first.body.yarns[0]).toMatchObject({ brand: "Lion Brand", color: "Fisherman", heldTogether: false });
    expect(first.body.yarns[1]).toMatchObject({ color: "Cranberry", heldTogether: true });
    expect(first.body.yarns[0].stashYarnId).toBeTruthy();

    const stash = await read(await request("/yarn-stash", { user: maker }));
    expect(stash).toHaveLength(2);
    expect(stash.every((yarn: { photoPath: string | null }) => yarn.photoPath === null)).toBe(true);

    const second = await createProject(maker, {
      yarns: [{ brand: "lionbrand", subBrand: "wool ease", color: "fisherman" }],
    });
    expect(second.body.yarns[0]).toMatchObject({
      stashYarnId: first.body.yarns[0].stashYarnId,
      brand: "Lion Brand",
      subBrand: "Wool-Ease",
      color: "Fisherman",
    });
    expect(await read(await request("/yarn-stash", { user: maker }))).toHaveLength(2);

    const other = await createProject(otherMaker, {
      yarns: [{ stashYarnId: first.body.yarns[0].stashYarnId }],
    });
    expect(other.status).toBe(400);
    expect(await read(await request("/yarn-stash", { user: otherMaker }))).toHaveLength(0);
  });

  it("asks for a brand on yarn that isn't picked from the stash", async () => {
    const response = await createProject(maker, { yarns: [{ color: "Leftover pink" }] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Add a brand for each yarn so it goes in your stash.");
  });

  it("adds yarn from projects saved before the stash to the stash", async () => {
    const [saved, moved] = await getTestDb()
      .insert(schema.projectsTable)
      .values([
        { ownerId: earlyMaker, title: "Market bag", craft: "crochet" },
        { ownerId: earlyMaker, title: "Old scarf", craft: "knitting", yarnBrand: "cascade", yarnType: "220", yarnColor: "oatmeal" },
      ])
      .returning();
    await getTestDb().insert(schema.projectYarnsTable).values([
      { projectId: saved!.id, position: 0, brand: "Cascade", subBrand: "220", color: "Oatmeal" },
      { projectId: saved!.id, position: 1, brand: null, subBrand: null, color: "Scrap green" },
    ]);

    const projects = await read(await request("/projects", { user: earlyMaker }));
    const bag = projects.find((project: { id: string }) => project.id === saved!.id);
    const scarf = projects.find((project: { id: string }) => project.id === moved!.id);
    expect(bag.yarns[0].stashYarnId).toBeTruthy();
    expect(bag.yarns[1]).toMatchObject({ color: "Scrap green", stashYarnId: null });
    expect(scarf.yarns[0]).toMatchObject({ stashYarnId: bag.yarns[0].stashYarnId, brand: "Cascade", subBrand: "220", color: "Oatmeal" });

    const stash = await read(await request("/yarn-stash", { user: earlyMaker }));
    expect(stash).toHaveLength(1);
    expect(stash[0]).toMatchObject({ brand: "Cascade", subBrand: "220", color: "Oatmeal", photoPath: null });
  });

  it("picks yarn from the stash and rejects bad skeins", async () => {
    const [stashYarn] = await read(await request("/yarn-stash?search=cranberry", { user: maker }));
    const picked = await createProject(maker, { yarns: [{ stashYarnId: stashYarn.id, brand: "ignored", skeinsUsed: 2 }] });
    expect(picked.body.yarns[0]).toMatchObject({ stashYarnId: stashYarn.id, brand: "Lion Brand", color: "Cranberry", skeinsUsed: 2 });

    const bad = await createProject(maker, { yarns: [{ color: "Blue", skeinsUsed: 1.3 }] });
    expect(bad.status).toBe(400);
  });

  it("suggests skeins left when a project is finished", async () => {
    const [fisherman] = await read(await request("/yarn-stash?search=fisherman", { user: maker }));
    await getTestDb().update(stashYarnsTable).set({ skeinsPurchased: 4 }).where(eq(stashYarnsTable.id, fisherman.id));
    const project = await createProject(maker, {
      status: "in_progress",
      yarns: [
        { stashYarnId: fisherman.id, skeinsUsed: 1.5 },
        { stashYarnId: fisherman.id, skeinsUsed: 1, heldTogether: true },
      ],
    });
    expect(await read(await request(`/yarn-stash/skein-suggestions?projectId=${project.body.id}`, { user: maker }))).toEqual([]);

    await request(`/projects/${project.body.id}`, { method: "PATCH", user: maker, body: { status: "completed" } });
    const [suggestion] = await read(await request(`/yarn-stash/skein-suggestions?projectId=${project.body.id}`, { user: maker }));
    expect(suggestion).toMatchObject({
      stashYarnId: fisherman.id,
      projectTitle: "Striped blanket",
      yarnName: "Lion Brand Wool-Ease Fisherman",
      skeinsUsed: 2.5,
      skeinsLeft: 4,
      suggestedLeft: 1.5,
    });
    expect(await read(await request("/yarn-stash/skein-suggestions", { user: otherMaker }))).toEqual([]);
    expect((await request(`/yarn-stash/skein-suggestions/${suggestion.id}/accept`, { method: "POST", user: otherMaker })).status).toBe(404);

    const accepted = await request(`/yarn-stash/skein-suggestions/${suggestion.id}/accept`, { method: "POST", user: maker });
    expect(await read(accepted)).toMatchObject({ skeinsPurchased: 4, skeinsLeft: 1.5 });
    expect((await request(`/yarn-stash/skein-suggestions/${suggestion.id}/accept`, { method: "POST", user: maker })).status).toBe(404);

    // Reopening and finishing again doesn't take the skeins off twice.
    await request(`/projects/${project.body.id}`, { method: "PATCH", user: maker, body: { status: "in_progress" } });
    await request(`/projects/${project.body.id}`, { method: "PATCH", user: maker, body: { status: "completed" } });
    expect(await read(await request(`/yarn-stash/skein-suggestions?projectId=${project.body.id}`, { user: maker }))).toEqual([]);

    // A suggestion still waiting is withdrawn when the project is reopened.
    const another = await createProject(maker, { status: "completed", yarns: [{ stashYarnId: fisherman.id, skeinsUsed: 1 }] });
    const [waiting] = await read(await request(`/yarn-stash/skein-suggestions?projectId=${another.body.id}`, { user: maker }));
    expect(waiting).toMatchObject({ skeinsLeft: 1.5, suggestedLeft: 0.5 });
    await request(`/projects/${another.body.id}`, { method: "PATCH", user: maker, body: { status: "paused" } });
    expect(await read(await request(`/yarn-stash/skein-suggestions?projectId=${another.body.id}`, { user: maker }))).toEqual([]);

    await request(`/projects/${another.body.id}`, { method: "PATCH", user: maker, body: { status: "completed" } });
    const [again] = await read(await request(`/yarn-stash/skein-suggestions?projectId=${another.body.id}`, { user: maker }));
    expect((await request(`/yarn-stash/skein-suggestions/${again.id}/dismiss`, { method: "POST", user: maker })).status).toBe(204);
    expect(await read(await request(`/yarn-stash/${fisherman.id}`, { user: maker }))).toMatchObject({ skeinsLeft: 1.5 });
  });

  it("suggests skeins left when a progress note finishes a project", async () => {
    const [cranberry] = await read(await request("/yarn-stash?search=cranberry", { user: maker }));
    await getTestDb().update(stashYarnsTable).set({ skeinsPurchased: 3 }).where(eq(stashYarnsTable.id, cranberry.id));
    const project = await createProject(maker, { status: "in_progress", yarns: [{ stashYarnId: cranberry.id, skeinsUsed: 2 }] });
    const note = await request(`/projects/${project.body.id}/progress`, { method: "POST", user: maker, body: { notes: "Done!", completionPercent: 100 } });
    expect(note.status).toBe(201);
    expect(await read(await request(`/yarn-stash/skein-suggestions?projectId=${project.body.id}`, { user: maker }))).toMatchObject([
      { skeinsUsed: 2, skeinsLeft: 3, suggestedLeft: 1 },
    ]);
  });

  it("lets a maker ask for a name review and the reviewer rename the catalog entry", async () => {
    const [fisherman] = await read(await request("/yarn-stash?search=fisherman", { user: maker }));
    expect(await read(await request("/catalog-reviews/access", { user: maker }))).toEqual({ reviewer: false });
    expect(await read(await request("/catalog-reviews/access", { user: reviewer }))).toEqual({ reviewer: true });

    const asked = await request("/catalog-reviews", {
      method: "POST",
      user: maker,
      body: { stashYarnId: fisherman.id, field: "sub_brand", suggestedName: "Wool-Ease Classic", note: "The label says Classic." },
    });
    expect(asked.status).toBe(201);
    const review = await read(asked);
    expect(review).toMatchObject({ field: "sub_brand", currentName: "Wool-Ease", suggestedName: "Wool-Ease Classic", status: "open" });
    expect((await request("/catalog-reviews", {
      method: "POST",
      user: otherMaker,
      body: { stashYarnId: fisherman.id, field: "brand", suggestedName: "Lion" },
    })).status).toBe(404);

    expect((await request("/catalog-reviews", { user: maker })).status).toBe(403);
    expect((await request(`/catalog-reviews/${review.id}/resolve`, { method: "POST", user: maker, body: { action: "rename" } })).status).toBe(403);
    const queue = await read(await request("/catalog-reviews", { user: reviewer }));
    expect(queue[0]).toMatchObject({ id: review.id, requesterName: "Maker", note: "The label says Classic." });

    const renamed = await request(`/catalog-reviews/${review.id}/resolve`, {
      method: "POST",
      user: reviewer,
      body: { action: "rename", reviewerNote: "Fixed, thanks." },
    });
    expect(await read(renamed)).toMatchObject({ status: "renamed", reviewerNote: "Fixed, thanks." });
    expect(await read(await request(`/yarn-stash/${fisherman.id}`, { user: maker }))).toMatchObject({ subBrand: "Wool-Ease Classic" });
    const projects = await read(await request("/projects?search=classic", { user: maker }));
    expect(projects.length).toBeGreaterThan(0);
    expect(await read(await request(`/yarn-stash/${fisherman.id}/reviews`, { user: maker }))).toMatchObject([{ status: "renamed" }]);
    expect(await read(await request(`/yarn-stash/${fisherman.id}/reviews`, { user: otherMaker }))).toEqual([]);

    const brandReview = await read(await request("/catalog-reviews", {
      method: "POST",
      user: maker,
      body: { stashYarnId: fisherman.id, field: "brand", suggestedName: "Lion Brand Yarn" },
    }));
    await createProject(otherMaker, { yarns: [{ brand: "Lion Brand Yarn" }] });
    const clash = await request(`/catalog-reviews/${brandReview.id}/resolve`, { method: "POST", user: reviewer, body: { action: "rename" } });
    expect(clash.status).toBe(400);
    const kept = await request(`/catalog-reviews/${brandReview.id}/resolve`, { method: "POST", user: reviewer, body: { action: "keep", reviewerNote: "Lion Brand is right." } });
    expect(await read(kept)).toMatchObject({ status: "kept" });
  });
});
