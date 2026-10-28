import { describe, expect, it } from "vitest";
import { averageDaysToFinish, mostUsedYarnBrands } from "./dashboardStats";

describe("mostUsedYarnBrands", () => {
  it("shows every tied brand A to Z, ignoring capital letters", () => {
    // PLAN.md test 2: 2 projects use Lion Brand, 2 use Big Twist, 1 uses Red Heart.
    const stat = mostUsedYarnBrands([
      { projectId: "p1", brand: "Lion Brand" },
      { projectId: "p2", brand: "lion brand" },
      { projectId: "p3", brand: "Big Twist" },
      { projectId: "p4", brand: "Big Twist" },
      { projectId: "p5", brand: "Red Heart" },
    ]);
    expect(stat).toEqual({ brands: ["Big Twist", "Lion Brand"], projectCount: 2 });
  });

  it("counts a project once even when it uses several colors of one brand", () => {
    const stat = mostUsedYarnBrands([
      { projectId: "p1", brand: "Red Heart" },
      { projectId: "p1", brand: "Red Heart" },
      { projectId: "p1", brand: "Red Heart" },
      { projectId: "p2", brand: "Lion Brand" },
      { projectId: "p3", brand: "Lion Brand" },
    ]);
    expect(stat).toEqual({ brands: ["Lion Brand"], projectCount: 2 });
  });

  it("returns no brand when no project yarn has one", () => {
    expect(mostUsedYarnBrands([{ projectId: "p1", brand: "  " }, { projectId: "p2", brand: null }])).toEqual({
      brands: [],
      projectCount: 0,
    });
  });
});

describe("averageDaysToFinish", () => {
  it("averages finished projects and leaves out ones missing a date", () => {
    expect(
      averageDaysToFinish([
        { status: "completed", startedAt: "2026-09-01", completedAt: "2026-09-11" }, // 10 days
        { status: "completed", startedAt: "2026-08-01", completedAt: "2026-08-21" }, // 20 days
        { status: "completed", startedAt: null, completedAt: "2026-10-01" },
        { status: "in_progress", startedAt: "2026-01-01", completedAt: null },
      ]),
    ).toBe(15);
  });

  it("returns null when no finished project has both dates", () => {
    expect(averageDaysToFinish([{ status: "completed", startedAt: null, completedAt: "2026-10-01" }])).toBeNull();
  });
});
