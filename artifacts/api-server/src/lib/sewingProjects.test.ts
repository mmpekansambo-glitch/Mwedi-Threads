import { describe, expect, it } from "vitest";
import { checkFabricLinks, checkMachineSettings, checkToolIds, fabricTypeCounts, stashLength, statusChanges } from "./sewingProjects";

describe("statusChanges", () => {
  it("dates a finished project and moves it to the Finish stage", () => {
    const changes = statusChanges({ status: "in_progress", completedAt: null }, "completed");
    expect(changes.stage).toBe("finish");
    expect(changes.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps an existing finished date and clears it on reopening", () => {
    expect(statusChanges({ status: "paused", completedAt: "2026-01-02" }, "completed").completedAt).toBe("2026-01-02");
    expect(statusChanges({ status: "completed", completedAt: "2026-01-02" }, "in_progress")).toEqual({ completedAt: null });
    expect(statusChanges({ status: "planning", completedAt: null }, "in_progress")).toEqual({});
    expect(statusChanges({ status: "completed", completedAt: "2026-01-02" }, undefined)).toEqual({});
  });
});

describe("checkFabricLinks", () => {
  it("rounds amounts and refuses the same fabric twice", () => {
    expect(checkFabricLinks([{ stashFabricId: "a", amountUsed: 1.256 }, { stashFabricId: "b" }])).toEqual({
      ok: true,
      links: [{ stashFabricId: "a", amountUsed: 1.26 }, { stashFabricId: "b", amountUsed: null }],
    });
    expect(checkFabricLinks([{ stashFabricId: "a" }, { stashFabricId: "a" }]).ok).toBe(false);
    expect(checkFabricLinks([{ stashFabricId: "a", amountUsed: 1000 }]).ok).toBe(false);
  });
});

describe("stashLength", () => {
  it("adds meters and yards in the unit most pieces use", () => {
    expect(stashLength([])).toEqual({ length: 0, unit: "meters" });
    expect(stashLength([{ unit: "meters", amount: 2 }, { unit: "yards", amount: 1 }])).toEqual({ length: 2.91, unit: "meters" });
    expect(stashLength([{ unit: "yards", amount: 2 }, { unit: "yards", amount: null }, { unit: "meters", amount: 0.9144 }]))
      .toEqual({ length: 3, unit: "yards" });
  });
});

describe("checkToolIds", () => {
  it("refuses the same tool twice", () => {
    expect(checkToolIds(["a", "b"])).toEqual({ ok: true, ids: ["a", "b"] });
    expect(checkToolIds(["a", "a"]).ok).toBe(false);
  });
});

describe("fabricTypeCounts", () => {
  it("counts pieces per type, most first, A to Z on a tie", () => {
    const pieces = ["linen", "cotton", "silk", "cotton", "denim", "silk", "cotton"].map((fabricType) => ({ fabricType }));
    expect(fabricTypeCounts(pieces)).toEqual([
      { fabricType: "cotton", count: 3 },
      { fabricType: "silk", count: 2 },
      { fabricType: "denim", count: 1 },
      { fabricType: "linen", count: 1 },
    ]);
    expect(fabricTypeCounts([])).toEqual([]);
  });
});

describe("checkMachineSettings", () => {
  it("tidies sets and drops ones with nothing filled in", () => {
    expect(checkMachineSettings([
      { name: "  Topstitch ", stitchLength: 3.5, notes: " " },
      { name: " ", notes: "" },
      { stitch: "zigzag", stitchWidth: 0 },
    ])).toEqual({
      ok: true,
      sets: [
        { name: "Topstitch", stitch: null, stitchLength: 3.5, stitchWidth: null, tension: null, presserFoot: null, notes: null },
        { name: null, stitch: "zigzag", stitchLength: null, stitchWidth: 0, tension: null, presserFoot: null, notes: null },
      ],
    });
  });

  it("keeps lengths, widths and tension to half steps within range", () => {
    expect(checkMachineSettings([{ stitchLength: 5.5 }]).ok).toBe(false);
    expect(checkMachineSettings([{ stitchWidth: 7.5 }]).ok).toBe(false);
    expect(checkMachineSettings([{ tension: 4.2 }]).ok).toBe(false);
    expect(checkMachineSettings([{ tension: -1 }]).ok).toBe(false);
    expect(checkMachineSettings([{ stitchLength: 2.5, stitchWidth: 7, tension: 9 }]).ok).toBe(true);
  });
});
