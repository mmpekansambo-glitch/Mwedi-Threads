import { describe, expect, it } from "vitest";
import { buildDashboardCharts, progressChartStart } from "./dashboardCharts";

// A Saturday, so the current week started on Monday 2026-10-12.
const now = new Date("2026-10-17T15:00:00.000Z");

describe("buildDashboardCharts", () => {
  it("counts every status, in a fixed order, including zeros", () => {
    const charts = buildDashboardCharts(
      [
        { status: "in_progress", completedAt: null },
        { status: "in_progress", completedAt: null },
        { status: "completed", completedAt: "2026-10-01" },
      ],
      [],
      now,
    );
    expect(charts.projectsByStatus).toEqual([
      { status: "planning", count: 0 },
      { status: "in_progress", count: 2 },
      { status: "paused", count: 0 },
      { status: "completed", count: 1 },
    ]);
  });

  it("buckets completed projects into the last 12 months and counts the undated ones", () => {
    const charts = buildDashboardCharts(
      [
        // A month-only date is saved as the 1st of the month.
        { status: "completed", completedAt: "2026-10-01" },
        { status: "completed", completedAt: "2026-10-15" },
        { status: "completed", completedAt: "2025-11-30" },
        // Older than the 12 months shown.
        { status: "completed", completedAt: "2025-10-31" },
        { status: "completed", completedAt: null },
        // Only completed projects count, whatever their date says.
        { status: "paused", completedAt: "2026-09-10" },
      ],
      [],
      now,
    );
    expect(charts.completedPerMonth).toHaveLength(12);
    expect(charts.completedPerMonth[0]).toEqual({ month: "2025-11", count: 1 });
    expect(charts.completedPerMonth[10]).toEqual({ month: "2026-09", count: 0 });
    expect(charts.completedPerMonth[11]).toEqual({ month: "2026-10", count: 2 });
    expect(charts.completedWithoutDate).toBe(1);
  });

  it("buckets progress entries into the last 12 Monday-start weeks", () => {
    const charts = buildDashboardCharts(
      [],
      [
        new Date("2026-10-12T00:00:00.000Z"), // Monday of this week
        new Date("2026-10-17T14:59:00.000Z"),
        new Date("2026-10-11T23:59:59.000Z"), // Sunday, last week
        new Date("2026-07-27T08:00:00.000Z"), // first week shown
        new Date("2026-07-26T08:00:00.000Z"), // too old
      ],
      now,
    );
    expect(progressChartStart(now).toISOString()).toBe("2026-07-27T00:00:00.000Z");
    expect(charts.progressPerWeek).toHaveLength(12);
    expect(charts.progressPerWeek[0]).toEqual({ weekStart: "2026-07-27", count: 1 });
    expect(charts.progressPerWeek[10]).toEqual({ weekStart: "2026-10-05", count: 1 });
    expect(charts.progressPerWeek[11]).toEqual({ weekStart: "2026-10-12", count: 2 });
  });

  it("treats a Sunday as the end of its week", () => {
    const sunday = new Date("2026-10-18T23:00:00.000Z");
    const charts = buildDashboardCharts([], [sunday], sunday);
    expect(charts.progressPerWeek[11]).toEqual({ weekStart: "2026-10-12", count: 1 });
  });
});
