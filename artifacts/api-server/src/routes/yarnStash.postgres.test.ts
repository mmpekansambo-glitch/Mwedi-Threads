import express, { type Request } from "express";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { stashTablesSql } from "../test/stashTablesSql";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

const databaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const ownerA = "stash-test-user-a";
const ownerB = "stash-test-user-b";
const photoA = `/objects/stash/${ownerA}/${randomUUID()}`;
const photoB = `/objects/stash/${ownerB}/${randomUUID()}`;

let schemaName: string | undefined;
let schemaCreated = false;
let adminPool: pg.Pool | undefined;
let testPool: pg.Pool | undefined;
let testDb: ReturnType<typeof drizzle> | undefined;
let server: ReturnType<express.Express["listen"]> | undefined;
let baseUrl: string;

function quoteIsolatedSchema(name: string): string {
  if (!/^stash_test_[0-9]+_[0-9a-f]+$/.test(name)) {
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

describe.skipIf(!databaseUrl)("yarn stash against PostgreSQL", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PostgreSQL stash tests cannot run in production.");
    }
    adminPool = new pg.Pool({ connectionString: databaseUrl });
    const { rows } = await adminPool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (/(^|[_-])prod(uction)?([_-]|$)/i.test(rows[0]?.database_name ?? "")) {
      throw new Error("Refusing to run PostgreSQL stash tests against a production database.");
    }

    schemaName = `stash_test_${process.pid}_${randomUUID().replaceAll("-", "")}`;
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
        id uuid PRIMARY KEY DEFAULT gen_random_uuid()
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
    // Photo cleanup talks to object storage, which these tests don't have.
    vi.doMock("../lib/objectStorage", () => ({
      deleteStoredObject: async () => undefined,
      signedObjectUrl: async () => "https://storage.test/signed",
      storageLocation: () => ({ bucketName: "bucket", objectName: "object" }),
    }));
    const { default: yarnStashRouter } = await import("./yarnStash");
    const app = express();
    app.use(express.json());
    app.use(yarnStashRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("PostgreSQL stash test server did not start.");
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

  const woolEase = {
    brand: "Lion Brand",
    subBrand: "Wool-Ease",
    color: "Fisherman",
    generalColor: "cream",
    weight: "worsted",
    blend: [{ fiber: "acrylic", percent: 80 }, { fiber: "Wool", percent: 20 }],
    brandLink: "https://www.lionbrand.com/products/wool-ease",
    photoPath: photoA,
    skeinsPurchased: 4,
  };

  it("adds a yarn and builds the shared catalog from it", async () => {
    const response = await request("/yarn-stash", { method: "POST", user: ownerA, body: woolEase });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      brand: "Lion Brand",
      subBrand: "Wool-Ease",
      color: "Fisherman",
      generalColor: "cream",
      weight: "worsted",
      blend: [{ fiber: "Acrylic", percent: 80 }, { fiber: "Wool", percent: 20 }],
      skeinsPurchased: 4,
      skeinsLeft: 4,
    });

    const catalog = await request("/yarn-catalog?brand=Lion%20Brand&subBrand=Wool-Ease", { user: ownerB });
    expect(await catalog.json()).toMatchObject({
      brands: ["Lion Brand"],
      subBrands: [{ name: "Wool-Ease", link: woolEase.brandLink }],
      colors: [{ name: "Fisherman", generalColor: "cream" }],
      suggestions: { brand: null, subBrand: null, color: null },
    });
  });

  it("merges a differently written brand into the existing catalog entry", async () => {
    const response = await request("/yarn-stash", {
      method: "POST",
      user: ownerB,
      body: { brand: "lionbrand", subBrand: "wool ease", color: "Cranberry", photoPath: photoB },
    });
    expect(await response.json()).toMatchObject({
      brand: "Lion Brand",
      subBrand: "Wool-Ease",
      color: "Cranberry",
      blend: [],
    });
    const catalog = await request("/yarn-catalog?brand=Lion%20Brand&subBrand=Wool-Ease", { user: ownerA });
    const body = await read(catalog);
    expect(body.brands).toEqual(["Lion Brand"]);
    expect(body.colors.map((color: { name: string }) => color.name)).toEqual(["Cranberry", "Fisherman"]);
  });

  it("offers Did you mean for a near miss", async () => {
    const catalog = await request("/yarn-catalog?brand=Lion%20Brnad", { user: ownerB });
    expect((await read(catalog)).suggestions.brand).toBe("Lion Brand");
  });

  it("keeps each maker's stash to themselves", async () => {
    const mine = await read(await request("/yarn-stash", { user: ownerA }));
    expect(mine).toHaveLength(1);
    const other = await request(`/yarn-stash/${mine[0].id}`, { user: ownerB });
    expect(other.status).toBe(404);
    const photo = await request(`/yarn-stash/${mine[0].id}/photo`, { user: ownerB });
    expect(photo.status).toBe(404);
    const stolenPhoto = await request("/yarn-stash", {
      method: "POST",
      user: ownerB,
      body: { ...woolEase, photoPath: photoA },
    });
    expect(stolenPhoto.status).toBe(400);
  });

  it("searches and filters the stash", async () => {
    const byFiber = await read(await request("/yarn-stash?search=acrylic", { user: ownerA }));
    expect(byFiber).toHaveLength(1);
    const byWeight = await read(await request("/yarn-stash?weight=bulky", { user: ownerA }));
    expect(byWeight).toHaveLength(0);
    const byColor = await read(await request("/yarn-stash?generalColor=cream", { user: ownerA }));
    expect(byColor).toHaveLength(1);
  });

  it("checks the blend and skeins", async () => {
    const badBlend = await request("/yarn-stash", {
      method: "POST",
      user: ownerA,
      body: { ...woolEase, blend: [{ fiber: "Wool", percent: 60 }] },
    });
    expect((await read(badBlend)).error).toContain("100%");
    const [yarn] = await read(await request("/yarn-stash", { user: ownerA }));
    const tooMany = await request(`/yarn-stash/${yarn.id}`, { method: "PATCH", user: ownerA, body: { skeinsLeft: 5 } });
    expect(tooMany.status).toBe(400);
    const used = await request(`/yarn-stash/${yarn.id}`, { method: "PATCH", user: ownerA, body: { skeinsLeft: 2.5 } });
    expect(await used.json()).toMatchObject({ skeinsLeft: 2.5, skeinsPurchased: 4, brand: "Lion Brand" });
  });

  it("removes a yarn", async () => {
    const [yarn] = await read(await request("/yarn-stash", { user: ownerA }));
    expect((await request(`/yarn-stash/${yarn.id}`, { method: "DELETE", user: ownerB })).status).toBe(404);
    expect((await request(`/yarn-stash/${yarn.id}`, { method: "DELETE", user: ownerA })).status).toBe(204);
    expect(await read(await request("/yarn-stash", { user: ownerA }))).toEqual([]);
  });
});
