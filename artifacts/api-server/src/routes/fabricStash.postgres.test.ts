import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { sewingTablesSql, stashTablesSql } from "../test/stashTablesSql";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const ownerA = "fabric-test-user-a";
const ownerB = "fabric-test-user-b";
const newMaker = "fabric-test-new-maker";
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
  if (!/^fabric_test_[0-9]+_[0-9a-f]+$/.test(name)) {
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

describe.skipIf(!databaseUrl)("crafts and fabric stash against PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PostgreSQL fabric tests cannot run in production.");
    }
    adminPool = new pg.Pool({ connectionString: databaseUrl });
    const { rows } = await adminPool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
      throw new Error("Refusing to run PostgreSQL fabric tests against a production database.");
    }

    schemaName = `fabric_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
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
    const { default: craftsRouter } = await import("./crafts");
    const { default: fabricStashRouter } = await import("./fabricStash");
    const app = express();
    app.use(express.json());
    app.use(craftsRouter);
    app.use(fabricStashRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("PostgreSQL fabric test server did not start.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    await getTestDb().insert(usersTable).values([
      { id: ownerA, email: "a@example.test" },
      { id: ownerB, email: "b@example.test" },
      { id: newMaker, email: "new@example.test" },
    ]);
    await adminPool.query(`INSERT INTO ${isolatedSchema}.projects (owner_id) VALUES ($1)`, [ownerA]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await testPool?.end();
    if (schemaCreated && schemaName) {
      await adminPool?.query(`DROP SCHEMA ${quoteIsolatedSchema(schemaName)} CASCADE`);
    }
    await adminPool?.end();
  });

  it("starts existing makers on yarn only and asks new makers what they make", async () => {
    expect(await read(await request("/me/crafts", { user: ownerA }))).toEqual({ yarn: true, sewing: false, needsChoice: false });
    expect(await read(await request("/me/crafts", { user: newMaker }))).toEqual({ yarn: true, sewing: false, needsChoice: true });

    const chosen = await request("/me/crafts", { method: "PUT", user: newMaker, body: { yarn: false, sewing: true } });
    expect(chosen.status).toBe(200);
    expect(await read(chosen)).toEqual({ yarn: false, sewing: true, needsChoice: false });
  });

  it("keeps at least one craft on", async () => {
    const response = await request("/me/crafts", { method: "PUT", user: ownerA, body: { yarn: false, sewing: false } });
    expect(response.status).toBe(400);
    expect((await read(response)).error).toBe("Keep at least one craft on.");
  });

  it("adds, lists, searches and filters fabric for its owner only", async () => {
    const created = await request("/fabric-stash", {
      method: "POST",
      user: ownerA,
      body: {
        fabricType: "cotton", construction: "woven", print: "floral", generalColor: "blue",
        unit: "meters", amount: 2.5, width: 145, brand: "  Liberty  ", notes: "Lawn, for a summer dress",
        photoPaths: [photo(ownerA), photo(ownerA)],
      },
    });
    expect(created.status).toBe(201);
    const fabric = await read(created);
    expect(fabric).toMatchObject({ fabricType: "cotton", brand: "Liberty", amount: 2.5, width: 145, photoCount: 2 });
    expect(fabric.photoPaths).toBeUndefined();

    await request("/fabric-stash", {
      method: "POST",
      user: ownerA,
      body: { fabricType: "jersey", construction: "knit", print: "stripe", unit: "yards", amount: 1, photoPaths: [photo(ownerA)] },
    });

    expect(await read(await request("/fabric-stash", { user: ownerA }))).toHaveLength(2);
    expect(await read(await request("/fabric-stash", { user: ownerB }))).toHaveLength(0);
    expect((await read(await request("/fabric-stash?search=summer", { user: ownerA })))[0].id).toBe(fabric.id);
    expect((await read(await request("/fabric-stash?search=Jers", { user: ownerA })))[0].fabricType).toBe("jersey");
    expect(await read(await request("/fabric-stash?print=floral", { user: ownerA }))).toHaveLength(1);
    expect(await read(await request("/fabric-stash?fabricType=linen", { user: ownerA }))).toHaveLength(0);
    expect((await request(`/fabric-stash/${fabric.id}`, { user: ownerB })).status).toBe(404);
  });

  it("needs a photo of the print and only accepts the owner's uploads", async () => {
    const none = await request("/fabric-stash", { method: "POST", user: ownerA, body: { fabricType: "linen", unit: "meters", photoPaths: [] } });
    expect(none.status).toBe(400);

    const someoneElses = await request("/fabric-stash", { method: "POST", user: ownerA, body: { fabricType: "linen", unit: "meters", photoPaths: [photo(ownerB)] } });
    expect(someoneElses.status).toBe(400);
    expect((await read(someoneElses)).error).toBe("One of the photos didn't upload. Please add it again.");

    const tooMany = await request("/fabric-stash", {
      method: "POST", user: ownerA,
      body: { fabricType: "linen", unit: "meters", photoPaths: [1, 2, 3, 4, 5].map(() => photo(ownerA)) },
    });
    expect(tooMany.status).toBe(400);
  });

  it("keeps, reorders and removes photos on edit, deleting the removed files", async () => {
    const first = photo(ownerA);
    const second = photo(ownerA);
    const fabric = await read(await request("/fabric-stash", {
      method: "POST", user: ownerA, body: { fabricType: "denim", unit: "meters", photoPaths: [first, second] },
    }));
    const added = photo(ownerA);
    const updated = await request(`/fabric-stash/${fabric.id}`, {
      method: "PATCH", user: ownerA, body: { photoPaths: ["keep:1", added], amount: 0.75 },
    });
    expect(updated.status).toBe(200);
    expect(await read(updated)).toMatchObject({ photoCount: 2, amount: 0.75, fabricType: "denim" });
    expect(deletedPhotos).toContain(first.slice("/objects/".length));

    const photoResponse = await request(`/fabric-stash/${fabric.id}/photos/1`, { user: ownerA });
    expect(photoResponse.status).toBe(302);
    expect((await request(`/fabric-stash/${fabric.id}/photos/2`, { user: ownerA })).status).toBe(404);
    expect((await request(`/fabric-stash/${fabric.id}/photos/0`, { user: ownerB })).status).toBe(404);
  });

  it("removes fabric and its photos", async () => {
    const only = photo(ownerB);
    const fabric = await read(await request("/fabric-stash", {
      method: "POST", user: ownerB, body: { fabricType: "silk", unit: "meters", photoPaths: [only] },
    }));
    expect((await request(`/fabric-stash/${fabric.id}`, { method: "DELETE", user: ownerA })).status).toBe(404);
    expect((await request(`/fabric-stash/${fabric.id}`, { method: "DELETE", user: ownerB })).status).toBe(204);
    expect(deletedPhotos).toContain(only.slice("/objects/".length));
  });
});
