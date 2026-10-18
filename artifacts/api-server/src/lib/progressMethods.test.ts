import { describe, expect, it } from "vitest";
import { checkProgressSettings, workOutProgress, type ProgressSettings } from "./progressMethods";

const estimate: ProgressSettings = { progressMethod: "estimate", progressTotal: null, progressSections: [] };
const rows: ProgressSettings = { progressMethod: "rows", progressTotal: 120, progressSections: [] };
const skeins: ProgressSettings = { progressMethod: "skeins", progressTotal: 4, progressSections: [] };
const sections: ProgressSettings = {
  progressMethod: "sections",
  progressTotal: null,
  progressSections: [
    { name: "Back", done: true },
    { name: "Front", done: false },
    { name: "Sleeves", done: false },
  ],
};

describe("workOutProgress", () => {
  it("uses the maker's own guess for the estimate method", () => {
    expect(workOutProgress(estimate, { completionPercent: 40 })).toEqual({ ok: true, completionPercent: 40, progressValue: null });
    expect(workOutProgress(estimate, {}).ok).toBe(false);
  });

  it("works out rows or rounds against the total, capped at 100", () => {
    expect(workOutProgress(rows, { progressValue: 30 })).toEqual({ ok: true, completionPercent: 25, progressValue: 30 });
    expect(workOutProgress(rows, { progressValue: 130 })).toMatchObject({ completionPercent: 100 });
    expect(workOutProgress(rows, { progressValue: 30.5 }).ok).toBe(false);
    expect(workOutProgress(rows, { completionPercent: 50 }).ok).toBe(false);
  });

  it("allows half skeins", () => {
    expect(workOutProgress(skeins, { progressValue: 2.5 })).toEqual({ ok: true, completionPercent: 63, progressValue: 2.5 });
    expect(workOutProgress(skeins, { progressValue: 2.3 }).ok).toBe(false);
  });

  it("ticks off sections equally and returns their new state", () => {
    expect(workOutProgress(sections, { sectionsDone: [0, 2] })).toEqual({
      ok: true,
      completionPercent: 67,
      progressValue: null,
      progressSections: [
        { name: "Back", done: true },
        { name: "Front", done: false },
        { name: "Sleeves", done: true },
      ],
    });
    expect(workOutProgress(sections, {})).toMatchObject({ completionPercent: 0 });
    expect(workOutProgress(sections, { sectionsDone: [3] }).ok).toBe(false);
  });

  it("asks for a total before rows or skeins can be worked out", () => {
    expect(workOutProgress({ ...rows, progressTotal: null }, { progressValue: 3 }).ok).toBe(false);
  });
});

describe("checkProgressSettings", () => {
  it("needs a whole number of rows and whole or half skeins", () => {
    expect(checkProgressSettings(rows).ok).toBe(true);
    expect(checkProgressSettings({ ...rows, progressTotal: null }).ok).toBe(false);
    expect(checkProgressSettings({ ...rows, progressTotal: 10.5 }).ok).toBe(false);
    expect(checkProgressSettings({ ...skeins, progressTotal: 3.5 }).ok).toBe(true);
    expect(checkProgressSettings({ ...skeins, progressTotal: 3.2 }).ok).toBe(false);
  });

  it("trims section names and drops blank ones", () => {
    expect(checkProgressSettings({
      ...sections,
      progressSections: [{ name: "  Yoke ", done: false }, { name: "  ", done: false }],
    })).toEqual({
      ok: true,
      settings: { progressMethod: "sections", progressTotal: null, progressSections: [{ name: "Yoke", done: false }] },
    });
    expect(checkProgressSettings({ ...sections, progressSections: [] }).ok).toBe(false);
  });
});
