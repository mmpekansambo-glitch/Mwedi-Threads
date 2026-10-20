import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ pool: {} }));

import { expectedTables, findMissing, type TableColumns } from "./schemaCheck";

describe("expectedTables", () => {
  it("lists every table in the schema with its columns", () => {
    const expected = expectedTables();
    expect(expected.has("projects")).toBe(true);
    expect(expected.has("project_yarns")).toBe(true);
    expect(expected.get("projects")?.has("needle_size")).toBe(true);
  });
});

describe("findMissing", () => {
  const expected: TableColumns = new Map([
    ["projects", new Set(["id", "needle_size"])],
    ["project_yarns", new Set(["id"])],
  ]);

  it("finds nothing when the database matches", () => {
    expect(findMissing(expected, expected)).toEqual({ missingTables: [], missingColumns: [] });
  });

  it("names missing tables and columns", () => {
    const actual: TableColumns = new Map([["projects", new Set(["id"])]]);
    expect(findMissing(expected, actual)).toEqual({
      missingTables: ["project_yarns"],
      missingColumns: ["projects.needle_size"],
    });
  });
});
