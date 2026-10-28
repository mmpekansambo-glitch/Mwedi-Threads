import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { yarnToolsSql } from "../test/stashTablesSql";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const ownerA = "yarn-tools-test-user-a";
const ownerB = "yarn-tools-test-user-b";
const photo = (owner: string) => `/objects/yarn-tools/${owner}/${randomUUID()}`;

let schemaName: string | undefined;
let schemaCreated = false;
let adminPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;
let server: ReturnType<express.Express["listen"]> | undefined;
let baseUrl: string;
const deletedPhotos: string[] = [];

function quoteIsolatedSchema(name: string): string {
  if (!/^yarn_tools_test_[0-9]+_[0-9a-f]+$/.test(name)) {
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

describe.skipIf(!databaseUrl)("yarn tools against PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PostgreSQL tools tests cannot run in production.");
    }
    adminPool = new pg.Pool({ connectionString: databaseUrl });
    const { rows } = await adminPool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
      throw new Error("Refusing to run PostgreSQL tools tests against a production database.");
    }

    schemaName = `yarn_tools_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
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
      ${yarnToolsSql(isolatedSchema)}
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
    const { default: yarnToolsRouter } = await import("./yarnTools");
    const app = express();
    app.use(express.json());
    app.use(yarnToolsRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("PostgreSQL tools test server did not start.");
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

  const hook = "4.0 mm (US G-6, UK/Canada 8)";
  const needle = "4.0 mm (US 6, UK/Canada 8)";

  async function addTool(owner: string, body: Record<string, unknown> = {}) {
    return request("/yarn-tools", {
      method: "POST",
      user: owner,
      body: { section: "hooks", size: hook, ...body },
    });
  }

  it("adds hooks, needles and notions for their owner only", async () => {
    const created = await addTool(ownerA, { material: "bamboo", quantity: 2, brand: " Clover ", photoPath: photo(ownerA) });
    expect(created.status).toBe(201);
    const bamboo = await read(created);
    expect(bamboo).toMatchObject({ section: "hooks", size: hook, material: "bamboo", quantity: 2, brand: "Clover", name: null, hasPhoto: true });
    expect(bamboo.ownerId).toBeUndefined();
    expect(bamboo.photoPath).toBeUndefined();
    await addTool(ownerA, { section: "needles", size: needle, needleType: "circular", cableLength: "80 cm (32 in)" });
    await addTool(ownerA, { section: "notions", size: null, notionType: "stitch_markers", name: "Locking markers", quantity: 40 });

    expect(await read(await request("/yarn-tools", { user: ownerA }))).toHaveLength(3);
    expect(await read(await request("/yarn-tools", { user: ownerB }))).toHaveLength(0);
    expect(await read(await request("/yarn-tools?section=needles", { user: ownerA }))).toMatchObject([{ needleType: "circular", cableLength: "80 cm (32 in)", hasPhoto: false }]);
    expect(await read(await request("/yarn-tools?search=locking", { user: ownerA }))).toHaveLength(1);
    expect(await read(await request("/yarn-tools?search=US%20G-6", { user: ownerA }))).toHaveLength(1);
    expect((await request(`/yarn-tools/${bamboo.id}`, { user: ownerB })).status).toBe(404);
    expect((await request(`/yarn-tools/${bamboo.id}/photo`, { user: ownerA })).status).toBe(302);
  });

  it("checks sizes and types per section and photos in the owner's folder", async () => {
    expect((await addTool(ownerA, { size: needle })).status).toBe(400);
    expect((await addTool(ownerA, { section: "needles", size: null })).status).toBe(400);
    expect((await addTool(ownerA, { section: "notions", size: null })).status).toBe(400);
    const straight = await read(await addTool(ownerA, { section: "needles", size: needle, needleType: "straight", cableLength: "80 cm (32 in)" }));
    expect(straight.cableLength).toBeNull();
    expect((await addTool(ownerA, { photoPath: photo(ownerB) })).status).toBe(400);
  });

  it("changes a tool, swaps or removes its photo, and deletes it", async () => {
    const firstPhoto = photo(ownerA);
    const tool = await read(await addTool(ownerA, { photoPath: firstPhoto }));
    const secondPhoto = photo(ownerA);
    const swapped = await read(await request(`/yarn-tools/${tool.id}`, {
      method: "PATCH", user: ownerA, body: { quantity: 3, material: "steel", photoPath: secondPhoto },
    }));
    expect(swapped).toMatchObject({ size: hook, quantity: 3, material: "steel", hasPhoto: true });
    expect(deletedPhotos).toContain(firstPhoto.slice("/objects/".length));

    const cleared = await read(await request(`/yarn-tools/${tool.id}`, {
      method: "PATCH", user: ownerA, body: { photoPath: null, brand: "" },
    }));
    expect(cleared).toMatchObject({ hasPhoto: false, brand: null });
    expect(deletedPhotos).toContain(secondPhoto.slice("/objects/".length));
    expect((await request(`/yarn-tools/${tool.id}`, { method: "PATCH", user: ownerA, body: { section: "notions" } })).status).toBe(400);
    const moved = await read(await request(`/yarn-tools/${tool.id}`, { method: "PATCH", user: ownerA, body: { section: "notions", notionType: "scissors" } }));
    expect(moved).toMatchObject({ section: "notions", notionType: "scissors", size: null });

    expect((await request(`/yarn-tools/${tool.id}`, { method: "DELETE", user: ownerB })).status).toBe(404);
    expect((await request(`/yarn-tools/${tool.id}`, { method: "DELETE", user: ownerA })).status).toBe(204);
    expect((await request(`/yarn-tools/${tool.id}`, { user: ownerA })).status).toBe(404);
  });
});
