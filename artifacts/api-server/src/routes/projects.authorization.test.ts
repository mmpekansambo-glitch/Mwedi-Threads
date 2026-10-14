import express, { type Request } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { progressEntriesTable, projectsTable } from "@workspace/db/schema";
import projectsRouter from "./projects";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));
const logError = vi.fn();

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => ({
    userId: req.headers["x-test-user"] ?? null,
  }),
}));

vi.mock("@workspace/db", async () => {
  const schema = await vi.importActual<typeof import("@workspace/db/schema")>(
    "@workspace/db/schema",
  );
  return { ...schema, db: mockDb };
});

const ownerA = "user-a";
const ownerB = "user-b";
const projectAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const progressAId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const progressBId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const timestamp = new Date("2026-10-13T12:00:00.000Z");

function project(id: string, ownerId: string, title: string) {
  return {
    id,
    ownerId,
    title,
    craft: "knitting" as const,
    status: "in_progress" as const,
    description: null,
    patternName: null,
    patternDesigner: null,
    yarn: null,
    tools: null,
    startedAt: null,
    targetDate: null,
    completionPercent: 25,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function progress(
  id: string,
  projectId: string,
  notes: string,
  photoPath: string | null,
) {
  return {
    id,
    projectId,
    notes,
    photoPath,
    completionPercent: 25,
    createdAt: timestamp,
  };
}

let projects: ReturnType<typeof project>[];
let progressEntries: ReturnType<typeof progress>[];

class Query {
  private table: typeof projectsTable | typeof progressEntriesTable | undefined;
  private joinTable: typeof projectsTable | undefined;
  private condition: unknown;
  private valuesToWrite: Record<string, unknown> | undefined;
  private rowValues: Record<string, unknown> | undefined;
  private rowLimit: number | undefined;

  constructor(
    private readonly action: "select" | "insert" | "update" | "delete",
    private readonly selection?: Record<string, unknown>,
  ) {}

  from(table: typeof projectsTable | typeof progressEntriesTable) {
    this.table = table;
    return this;
  }

  innerJoin(table: typeof projectsTable) {
    this.joinTable = table;
    return this;
  }

  where(condition: unknown) {
    this.condition = condition;
    return this;
  }

  orderBy() {
    return this;
  }

  limit(limit: number) {
    this.rowLimit = limit;
    return this;
  }

  set(values: Record<string, unknown>) {
    this.valuesToWrite = values;
    return this;
  }

  values(values: Record<string, unknown>) {
    this.rowValues = values;
    return this;
  }

  returning() {
    return this;
  }

  private matches(row: Record<string, unknown>, sql: string, params: unknown[]) {
    const tableName = this.table === projectsTable ? "projects" : "project_progress_entries";
    const comparisons = [...sql.matchAll(
      new RegExp(`"${tableName}"\\."(owner_id|id|project_id)" = \\$(\\d+)`, "g"),
    )];
    return comparisons.every(([, column, parameter]) => {
      const value = params[Number(parameter) - 1];
      const property =
        column === "owner_id" ? "ownerId" :
        column === "project_id" ? "projectId" : "id";
      return row[property] === value;
    });
  }

  private async execute() {
    if (!this.table) return [];
    const compiled = this.condition
      ? new PgDialect().sqlToQuery(this.condition as never)
      : { sql: "", params: [] };
    const rows =
      this.table === projectsTable ? projects : progressEntries;
    const matched = rows.filter((row) =>
      this.matches(row as unknown as Record<string, unknown>, compiled.sql, compiled.params),
    );

    if (this.action === "select") {
      const selected = this.joinTable === projectsTable
        ? (matched as ReturnType<typeof progress>[]).flatMap((entry): Record<string, unknown>[] => {
            const parent = projects.find((candidate) => candidate.id === entry.projectId);
            if (!parent) return [];
            const ownerClause = compiled.sql.match(/"projects"\."owner_id" = \$(\d+)/);
            if (ownerClause && parent.ownerId !== compiled.params[Number(ownerClause[1]) - 1]) {
              return [];
            }
            const row = this.selection && "id" in this.selection
              ? { id: entry.id, projectId: entry.projectId }
              : this.selection && "photoPath" in this.selection
              ? {
                  id: entry.id,
                  projectId: entry.projectId,
                  photoPath: entry.photoPath,
                  notes: entry.notes,
                  completionPercent: entry.completionPercent,
                }
              : {
                  projectTitle: parent.title,
                  projectId: parent.id,
                  notes: entry.notes,
                  completionPercent: entry.completionPercent,
                  createdAt: entry.createdAt,
                };
            return [row];
          })
        : matched;
      return this.rowLimit === undefined ? selected : selected.slice(0, this.rowLimit);
    }

    if (this.action === "update") {
      for (const row of matched) Object.assign(row, this.valuesToWrite);
      return matched;
    }

    if (this.action === "delete") {
      const deletedIds = new Set(matched.map((row) => row.id));
      if (this.table === projectsTable) {
        projects = projects.filter((row) => !deletedIds.has(row.id));
        progressEntries = progressEntries.filter((row) => !deletedIds.has(row.projectId));
      } else {
        progressEntries = progressEntries.filter((row) => !deletedIds.has(row.id));
      }
      return matched;
    }

    if (this.action === "insert" && this.rowValues) {
      const created = {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        ...this.rowValues,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      if (this.table === projectsTable) projects.push(created as ReturnType<typeof project>);
      else progressEntries.push(created as unknown as ReturnType<typeof progress>);
      return [created];
    }

    return [];
  }

  then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
    return this.execute().then(resolve, reject);
  }
}

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).log = {
    debug: () => undefined,
    error: logError,
  };
  next();
});
app.use(projectsRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

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

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
});

beforeEach(() => {
  projects = [
    project(projectAId, ownerA, "A's sweater"),
    project(projectBId, ownerB, "B's blanket"),
  ];
  progressEntries = [
    progress(progressAId, projectAId, "A's private progress", `/objects/progress/${projectAId}/photo-a`),
    progress(progressBId, projectBId, "B's private progress", `/objects/progress/${projectBId}/photo-b`),
  ];
  mockDb.select.mockImplementation((selection) => new Query("select", selection));
  mockDb.insert.mockImplementation((table) => new Query("insert").from(table));
  mockDb.update.mockImplementation((table) => new Query("update").from(table));
  mockDb.delete.mockImplementation((table) => new Query("delete").from(table));
  mockDb.transaction.mockReset();
  logError.mockReset();
});

describe("project authorization", () => {
  it("deletes project photos and leaves them inaccessible through the app", async () => {
    const actualFetch = globalThis.fetch.bind(globalThis);
    const storageFetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        if (String(input) === "http://127.0.0.1:1106/object-storage/signed-object-url") {
          const body = JSON.parse(String(init?.body)) as { method: string };
          expect(body.method).toBe("DELETE");
          return new Response(JSON.stringify({ signed_url: "https://storage.test/photo" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (String(input) === "https://storage.test/photo") {
          expect(init?.method).toBe("DELETE");
          return new Response(null, { status: 204 });
        }
        return actualFetch(input, init);
      },
    );
    const previousPrivateDir = process.env.PRIVATE_OBJECT_DIR;
    process.env.PRIVATE_OBJECT_DIR = "/private-bucket";
    try {
      const response = await request(`/projects/${projectAId}`, {
        method: "DELETE",
        user: ownerA,
      });
      expect(response.status).toBe(204);
      expect(projects.map(({ id }) => id)).not.toContain(projectAId);
      expect(progressEntries.map(({ projectId }) => projectId)).not.toContain(projectAId);
      expect(storageFetch).toHaveBeenCalled();

      const photoResponse = await request(
        `/projects/${projectAId}/progress/${progressAId}/photo`,
        { user: ownerA },
      );
      expect(photoResponse.status).toBe(404);
      expect(logError).not.toHaveBeenCalled();
    } finally {
      storageFetch.mockRestore();
      if (previousPrivateDir === undefined) delete process.env.PRIVATE_OBJECT_DIR;
      else process.env.PRIVATE_OBJECT_DIR = previousPrivateDir;
    }
  });

  it("logs failed object deletion but keeps the photo inaccessible", async () => {
    const actualFetch = globalThis.fetch.bind(globalThis);
    const storageFetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (input, init) => {
        if (String(input) === "http://127.0.0.1:1106/object-storage/signed-object-url") {
          return new Response(JSON.stringify({ signed_url: "https://storage.test/photo" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (String(input) === "https://storage.test/photo") {
          return new Response(null, { status: 500 });
        }
        return actualFetch(input, init);
      },
    );
    const previousPrivateDir = process.env.PRIVATE_OBJECT_DIR;
    const photoPath = progressEntries[0]?.photoPath;
    process.env.PRIVATE_OBJECT_DIR = "/private-bucket";
    try {
      const response = await request(`/projects/${projectAId}`, {
        method: "DELETE",
        user: ownerA,
      });
      expect(response.status).toBe(204);
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: projectAId, photoPath }),
        "Could not delete stored progress photo",
      );

      const photoResponse = await request(
        `/projects/${projectAId}/progress/${progressAId}/photo`,
        { user: ownerA },
      );
      expect(photoResponse.status).toBe(404);
    } finally {
      storageFetch.mockRestore();
      if (previousPrivateDir === undefined) delete process.env.PRIVATE_OBJECT_DIR;
      else process.env.PRIVATE_OBJECT_DIR = previousPrivateDir;
    }
  });

  it("deletes projects without photos without calling object storage", async () => {
    progressEntries[0].photoPath = null;
    const response = await request(`/projects/${projectAId}`, {
      method: "DELETE",
      user: ownerA,
    });
    expect(response.status).toBe(204);
    expect(projects.map(({ id }) => id)).not.toContain(projectAId);
    expect(logError).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated reads and changes before reaching the database", async () => {
    const responses = await Promise.all([
      request("/dashboard"),
      request("/projects"),
      request(`/projects/${projectAId}`),
      request("/projects", { method: "POST", body: { title: "New", craft: "knitting" } }),
      request(`/projects/${projectAId}`, { method: "PATCH", body: { title: "Changed" } }),
      request(`/projects/${projectAId}`, { method: "DELETE" }),
      request(`/projects/${projectAId}/progress-photo-upload`, {
        method: "POST",
        body: { name: "photo.jpg", size: 100, contentType: "image/jpeg" },
      }),
      request(`/projects/${projectAId}/progress/${progressAId}/photo`),
      request(`/projects/${projectAId}/progress/${progressAId}/photo`, { method: "DELETE" }),
      request(`/projects/${projectAId}/progress`, {
        method: "POST",
        body: { notes: "Unauthorized", completionPercent: 50 },
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual(
      Array(responses.length).fill(401),
    );
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("keeps another owner's project out of lists and blocks view, edit, delete, and progress writes", async () => {
    const listResponse = await request("/projects", { user: ownerB });
    expect(listResponse.status).toBe(200);
    expect(((await listResponse.json()) as { id: string }[]).map((item) => item.id)).toEqual([
      projectBId,
    ]);

    const detailResponse = await request(`/projects/${projectAId}`, { user: ownerB });
    expect(detailResponse.status).toBe(404);

    const removePhotoResponse = await request(
      `/projects/${projectAId}/progress/${progressAId}/photo`,
      { method: "DELETE", user: ownerB },
    );
    expect(removePhotoResponse.status).toBe(404);
    expect(progressEntries[0]).toMatchObject({
      notes: "A's private progress",
      photoPath: `/objects/progress/${projectAId}/photo-a`,
      completionPercent: 25,
    });

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

    const progressResponse = await request(`/projects/${projectAId}/progress`, {
      method: "POST",
      user: ownerB,
      body: { notes: "Unauthorized progress", completionPercent: 50 },
    });
    expect(progressResponse.status).toBe(404);
    const photoUploadResponse = await request(`/projects/${projectAId}/progress-photo-upload`, {
      method: "POST",
      user: ownerB,
      body: { name: "photo.jpg", size: 100, contentType: "image/jpeg" },
    });
    expect(photoUploadResponse.status).toBe(404);
    const photoViewResponse = await request(
      `/projects/${projectAId}/progress/${progressAId}/photo`,
      { user: ownerB },
    );
    expect(photoViewResponse.status).toBe(404);
    expect(projects.find((item) => item.id === projectAId)?.title).toBe("A's sweater");
    expect(projects.map((item) => item.id)).toContain(projectAId);
    expect(progressEntries).toHaveLength(2);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it("lets a project owner remove only the photo while preserving progress history", async () => {
    const response = await request(
      `/projects/${projectAId}/progress/${progressAId}/photo`,
      { method: "DELETE", user: ownerA },
    );

    expect(response.status).toBe(204);
    expect(progressEntries[0]).toMatchObject({
      id: progressAId,
      notes: "A's private progress",
      photoPath: null,
      completionPercent: 25,
      createdAt: timestamp,
    });
    expect(progressEntries[1].photoPath).toBe(`/objects/progress/${projectBId}/photo-b`);
  });

  it("limits dashboard totals, recent projects, and progress to the signed-in owner", async () => {
    const response = await request("/dashboard", { user: ownerA });
    expect(response.status).toBe(200);
    const dashboard = (await response.json()) as {
      totalProjects: number;
      activeProjects: number;
      completedProjects: number;
      recentProjects: { id: string }[];
      recentProgress: { projectId: string }[];
    };

    expect(dashboard.totalProjects).toBe(1);
    expect(dashboard.activeProjects).toBe(1);
    expect(dashboard.completedProjects).toBe(0);
    expect(dashboard.recentProjects.map((item) => item.id)).toEqual([
      projectAId,
    ]);
    expect(dashboard.recentProgress.map((item) => item.projectId)).toEqual([
      projectAId,
    ]);
    expect(JSON.stringify(dashboard)).not.toContain("B's");
  });
});
