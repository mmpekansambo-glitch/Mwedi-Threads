import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { sewingToolsSql } from "../test/stashTablesSql";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const ownerA = "tools-test-user-a";
const ownerB = "tools-test-user-b";
const photo = (owner: string) => `/objects/sewing-tools/${owner}/${randomUUID()}`;

let schemaName: string | undefined;
let schemaCreated = false;
let adminPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;
let server: ReturnType<express.Express["listen"]> | undefined;
let baseUrl: string;
const deletedPhotos: string[] = [];

function quoteIsolatedSchema(name: string): string {
  if (!/^tools_test_[0-9]+_[0-9a-f]+$/.test(name)) {
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

describe.skipIf(!databaseUrl)("sewing tools against PostgreSQL", () => {
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

    schemaName = `tools_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
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
      ${sewingToolsSql(isolatedSchema)}
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
    const { default: sewingToolsRouter } = await import("./sewingTools");
    const app = express();
    app.use(express.json());
    app.use(sewingToolsRouter);
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

  async function addTool(owner: string, body: Record<string, unknown> = {}) {
    return request("/sewing-tools", {
      method: "POST",
      user: owner,
      body: { section: "notions", category: "zip", name: "Invisible zip", ...body },
    });
  }

  it("adds notions and kit for their owner only", async () => {
    const created = await addTool(ownerA, { name: "  Invisible zip ", quantity: 3, size: "22 cm", color: "Navy", photoPath: photo(ownerA) });
    expect(created.status).toBe(201);
    const zip = await read(created);
    expect(zip).toMatchObject({ section: "notions", category: "zip", name: "Invisible zip", quantity: 3, size: "22 cm", color: "Navy", hasPhoto: true });
    expect(zip.ownerId).toBeUndefined();
    expect(zip.photoPath).toBeUndefined();
    await addTool(ownerA, { section: "kit", category: "machine", name: "Sewing machine", brand: "Maker Example" });

    expect(await read(await request("/sewing-tools", { user: ownerA }))).toHaveLength(2);
    expect(await read(await request("/sewing-tools", { user: ownerB }))).toHaveLength(0);
    expect(await read(await request("/sewing-tools?section=kit", { user: ownerA }))).toMatchObject([{ category: "machine", hasPhoto: false }]);
    expect(await read(await request("/sewing-tools?search=navy", { user: ownerA }))).toHaveLength(1);
    expect(await read(await request("/sewing-tools?category=thread", { user: ownerA }))).toHaveLength(0);
    expect((await request(`/sewing-tools/${zip.id}`, { user: ownerB })).status).toBe(404);
    expect((await request(`/sewing-tools/${zip.id}/photo`, { user: ownerA })).status).toBe(302);
  });

  it("keeps each type in its section and photos in the owner's folder", async () => {
    expect((await addTool(ownerA, { section: "kit", category: "zip" })).status).toBe(400);
    expect((await addTool(ownerA, { section: "kit", category: "other", name: "Tailor's ham" })).status).toBe(201);
    expect((await addTool(ownerA, { name: "   " })).status).toBe(400);
    const theirPhoto = await addTool(ownerA, { photoPath: photo(ownerB) });
    expect(theirPhoto.status).toBe(400);
  });

  it("changes a tool, swaps or removes its photo, and deletes it", async () => {
    const firstPhoto = photo(ownerA);
    const thread = await read(await addTool(ownerA, { category: "thread", name: "Polyester thread", photoPath: firstPhoto }));
    const secondPhoto = photo(ownerA);
    const swapped = await read(await request(`/sewing-tools/${thread.id}`, {
      method: "PATCH", user: ownerA, body: { quantity: 2, photoPath: secondPhoto },
    }));
    expect(swapped).toMatchObject({ name: "Polyester thread", quantity: 2, hasPhoto: true });
    expect(deletedPhotos).toContain(firstPhoto.slice("/objects/".length));

    const cleared = await read(await request(`/sewing-tools/${thread.id}`, {
      method: "PATCH", user: ownerA, body: { photoPath: null, color: "" },
    }));
    expect(cleared).toMatchObject({ hasPhoto: false, color: null });
    expect(deletedPhotos).toContain(secondPhoto.slice("/objects/".length));
    expect((await request(`/sewing-tools/${thread.id}`, { method: "PATCH", user: ownerA, body: { section: "kit" } })).status).toBe(400);

    expect((await request(`/sewing-tools/${thread.id}`, { method: "DELETE", user: ownerB })).status).toBe(404);
    expect((await request(`/sewing-tools/${thread.id}`, { method: "DELETE", user: ownerA })).status).toBe(204);
    expect((await request(`/sewing-tools/${thread.id}`, { user: ownerA })).status).toBe(404);
  });
});
