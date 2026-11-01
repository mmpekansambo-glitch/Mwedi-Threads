import { describe, expect, it } from "vitest";
import { addDays, isPlainDate, mondayOf, safeTimeZone, summariseWeek } from "./weeklyGoal";

describe("weekly goal maths", () => {
  it("finds Monday for every day of the week", () => {
    expect(mondayOf("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(mondayOf("2026-11-05")).toBe("2026-11-02");
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(mondayOf("2026-11-01")).toBe("2026-10-26");
  });

  it("checks plain dates and time zones", () => {
    expect(isPlainDate("2026-11-01")).toBe(true);
    expect(isPlainDate("2026-02-30")).toBe(false);
    expect(isPlainDate("Nov 1")).toBe(false);
    expect(safeTimeZone("America/Los_Angeles")).toBe("America/Los_Angeles");
    expect(safeTimeZone("Not/AZone")).toBe("UTC");
    expect(safeTimeZone("'; drop table users")).toBe("UTC");
    expect(safeTimeZone(undefined)).toBe("UTC");
  });

  it("fills the week's squares and counts days", () => {
    const days = new Set(["2026-11-02", "2026-11-04", "2026-10-30"]);
    const week = summariseWeek(days, "2026-11-05", 4);
    expect(week.weekStart).toBe("2026-11-02");
    expect(week.days).toEqual([true, false, true, false, false, false, false]);
    expect(week.count).toBe(2);
    expect(week.todayCounted).toBe(false);
  });

  it("counts weeks in a row, adding this week once it is met", () => {
    const days = new Set<string>();
    // Two full weeks before this one, each with 3 days.
    for (const start of ["2026-10-19", "2026-10-26"]) for (const offset of [0, 2, 4]) days.add(addDays(start, offset));
    expect(summariseWeek(days, "2026-11-03", 3).weeksInARow).toBe(2);
    days.add("2026-11-02").add("2026-11-03");
    expect(summariseWeek(days, "2026-11-03", 3).weeksInARow).toBe(2);
    days.add("2026-11-01"); // Sunday belongs to last week, already met
    days.add("2026-11-04");
    expect(summariseWeek(days, "2026-11-04", 3).weeksInARow).toBe(3);
    expect(summariseWeek(days, "2026-11-04", 4).weeksInARow).toBe(1); // only last week had 4 days
    expect(summariseWeek(days, "2026-11-04", null).weeksInARow).toBe(0);
  });
});
