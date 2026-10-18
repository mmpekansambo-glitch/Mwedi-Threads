import type { ProgressSection, Project } from "@workspace/db";

export type ProgressSettings = Pick<Project, "progressMethod" | "progressTotal" | "progressSections">;

export type ProgressInput = {
  completionPercent?: number;
  progressValue?: number;
  sectionsDone?: number[];
};

type Failure = { ok: false; error: string };

export type ProgressResult =
  | {
      ok: true;
      completionPercent: number;
      progressValue: number | null;
      // Only set for the sections method, where a note ticks parts off.
      progressSections?: ProgressSection[];
    }
  | Failure;

const isHalfStep = (value: number) => Number.isInteger(value * 2);

function percentOf(value: number, total: number): number {
  return Math.min(100, Math.round((value / total) * 100));
}

// Checks that a project's tracking method has what it needs to work out a
// percentage, and tidies section names. Returns the settings to store.
export function checkProgressSettings(
  settings: ProgressSettings,
): { ok: true; settings: ProgressSettings } | Failure {
  const { progressMethod, progressTotal } = settings;
  const progressSections = settings.progressSections
    .map((section) => ({ name: section.name.trim(), done: section.done }))
    .filter((section) => section.name);

  if (progressMethod === "rows" && (!progressTotal || !Number.isInteger(progressTotal))) {
    return { ok: false, error: "Add how many rows or rounds the project has." };
  }
  if (progressMethod === "skeins" && (!progressTotal || !isHalfStep(progressTotal))) {
    return { ok: false, error: "Add how many skeins you plan to use, in whole or half skeins." };
  }
  if (progressMethod === "sections" && progressSections.length === 0) {
    return { ok: false, error: "Add at least one pattern section." };
  }
  return { ok: true, settings: { progressMethod, progressTotal, progressSections } };
}

// Works out the completion percentage a progress note records, from the
// project's tracking method and what the maker entered.
export function workOutProgress(project: ProgressSettings, input: ProgressInput): ProgressResult {
  switch (project.progressMethod) {
    case "estimate":
      if (input.completionPercent === undefined) {
        return { ok: false, error: "Say about how far along the project is." };
      }
      return { ok: true, completionPercent: input.completionPercent, progressValue: null };

    case "rows":
    case "skeins": {
      const total = project.progressTotal;
      if (!total) {
        return { ok: false, error: "Set the project's total in Edit details first." };
      }
      const value = input.progressValue;
      const validStep = project.progressMethod === "rows" ? Number.isInteger : isHalfStep;
      if (value === undefined || !validStep(value)) {
        return {
          ok: false,
          error: project.progressMethod === "rows"
            ? "Say which row or round you're on."
            : "Say how many skeins you've used, in whole or half skeins.",
        };
      }
      return { ok: true, completionPercent: percentOf(value, total), progressValue: value };
    }

    case "sections": {
      const sections = project.progressSections;
      if (sections.length === 0) {
        return { ok: false, error: "Add the pattern sections in Edit details first." };
      }
      const done = new Set(input.sectionsDone ?? []);
      if ([...done].some((position) => position >= sections.length)) {
        return { ok: false, error: "That section isn't part of this project." };
      }
      const progressSections = sections.map((section, position) => ({ ...section, done: done.has(position) }));
      return {
        ok: true,
        completionPercent: percentOf(done.size, sections.length),
        progressValue: null,
        progressSections,
      };
    }
  }
}
