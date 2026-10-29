// Starts the real API routes against a brand-new PostgreSQL database built
// from lib/db/src/schema, so the scenario stories run on the same tables the
// app uses, not a hand-written copy. Sign-in, photo storage and the print
// photo check are stood in for (see fakes/); everything else is real.
import express from "express";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterEach, beforeEach, vi } from "vitest";
import * as schema from "@workspace/db/schema";
import { createScenarioDatabase, dbPackageFromSource } from "./scenarioDatabase";
import { printPhotos } from "./fakes/printPhoto";
import { deletedPhotos } from "./fakes/objectStorage";

export const scenarioDatabaseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;

// Read loosely: the stories check responses field by field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

type Reply = { status: number; body: Json };

export type Maker = {
  id: string;
  get: (path: string) => Promise<Reply>;
  post: (path: string, body?: unknown) => Promise<Reply>;
  patch: (path: string, body: unknown) => Promise<Reply>;
  put: (path: string, body?: unknown) => Promise<Reply>;
  del: (path: string) => Promise<Reply>;
};

export type Scenario = {
  maker: (id: string) => Maker;
  printPhotos: typeof printPhotos;
  deletedPhotos: string[];
  stop: () => Promise<void>;
};

export async function startScenario(): Promise<Scenario> {
  if (!scenarioDatabaseUrl) throw new Error("Set PROJECTS_AUTH_TEST_DATABASE_URL to run the scenario stories.");
  const database = await createScenarioDatabase(scenarioDatabaseUrl, dbPackageFromSource);
  const pool = new pg.Pool({ connectionString: database.url });
  // Dropping the database at the end closes any connection still winding
  // down; that's expected, not a failure.
  pool.on("error", () => undefined);
  const db = drizzle(pool, { schema });

  vi.doMock("@clerk/express", () => import("./fakes/clerk"));
  vi.doMock("@workspace/db", async () => ({ ...schema, db, pool }));
  vi.doMock("../lib/objectStorage", () => import("./fakes/objectStorage"));
  vi.doMock("../lib/printPhoto", () => import("./fakes/printPhoto"));

  const { default: routes } = await import("../routes/index");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = { debug: () => undefined, error: () => undefined, warn: () => undefined };
    next();
  });
  app.use(routes);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Scenario server did not start.");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  function maker(id: string): Maker {
    const send = async (method: string, path: string, body?: unknown): Promise<Reply> => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "x-test-user": id, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    };
    return {
      id,
      get: (path) => send("GET", path),
      post: (path, body) => send("POST", path, body ?? {}),
      patch: (path, body) => send("PATCH", path, body),
      put: (path, body) => send("PUT", path, body ?? {}),
      del: (path) => send("DELETE", path),
    };
  }

  async function stop() {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    await database.drop();
  }

  return { maker, printPhotos, deletedPhotos, stop };
}

// The steps of a story build on each other, so once one fails the rest are
// skipped: the first failure is where the story broke.
export function stopAtFirstFailure(): void {
  let broken = false;
  beforeEach((context) => {
    if (broken) context.skip();
  });
  afterEach((context) => {
    if (context.task.result?.state === "fail") broken = true;
  });
}
