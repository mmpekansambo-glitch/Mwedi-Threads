export const sewingStages = ["prep", "cut", "sew", "fit", "finish"] as const;
export type SewingStage = (typeof sewingStages)[number];
type Status = "planning" | "in_progress" | "paused" | "completed";
type FabricUnit = "meters" | "yards";

const metersPerYard = 0.9144;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Finishing a project dates it today and moves it to the Finish stage;
// reopening a finished project clears the date.
export function statusChanges(
  current: { status: Status; completedAt: string | null },
  nextStatus: Status | undefined,
): { completedAt?: string | null; stage?: SewingStage } {
  if (nextStatus === undefined || nextStatus === current.status) return {};
  if (nextStatus === "completed") return { completedAt: current.completedAt ?? today(), stage: "finish" };
  if (current.status === "completed") return { completedAt: null };
  return {};
}

type FabricLink = { stashFabricId: string; amountUsed?: number | null };
type LinksCheck =
  | { ok: true; links: { stashFabricId: string; amountUsed: number | null }[] }
  | { ok: false; error: string };

// Each stash fabric appears once on a project, with up to two decimals used.
export function checkFabricLinks(links: FabricLink[]): LinksCheck {
  const seen = new Set<string>();
  const checked = [];
  for (const link of links) {
    if (seen.has(link.stashFabricId)) return { ok: false, error: "That fabric is already on this project." };
    seen.add(link.stashFabricId);
    const amount = link.amountUsed ?? null;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 999)) {
      return { ok: false, error: "Enter amounts between 0 and 999." };
    }
    checked.push({ stashFabricId: link.stashFabricId, amountUsed: amount === null ? null : Math.round(amount * 100) / 100 });
  }
  return { ok: true, links: checked };
}

// The stash total is shown in whichever unit most pieces use (meters on a tie).
export function stashLength(pieces: { unit: FabricUnit; amount: number | null }[]): { length: number; unit: FabricUnit } {
  const yardPieces = pieces.filter((piece) => piece.unit === "yards").length;
  const unit: FabricUnit = yardPieces > pieces.length - yardPieces ? "yards" : "meters";
  const meters = pieces.reduce(
    (total, piece) => total + (piece.amount ?? 0) * (piece.unit === "yards" ? metersPerYard : 1),
    0,
  );
  const length = unit === "yards" ? meters / metersPerYard : meters;
  return { length: Math.round(length * 100) / 100, unit };
}

// Each tool appears once on a project.
export function checkToolIds(ids: string[]): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (new Set(ids).size !== ids.length) return { ok: false, error: "That tool is already on this project." };
  return { ok: true, ids };
}

// Pieces of each fabric type in the stash, most first (A to Z on a tie).
// Types the maker has none of are left out.
export function fabricTypeCounts<T extends string>(pieces: { fabricType: T }[]): { fabricType: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const piece of pieces) counts.set(piece.fabricType, (counts.get(piece.fabricType) ?? 0) + 1);
  return [...counts]
    .map(([fabricType, count]) => ({ fabricType, count }))
    .sort((a, b) => b.count - a.count || a.fabricType.localeCompare(b.fabricType));
}

type MachineSettingInput<S, F> = {
  name?: string | null;
  stitch?: S | null;
  stitchLength?: number | null;
  stitchWidth?: number | null;
  tension?: number | null;
  presserFoot?: F | null;
  notes?: string | null;
};
export type MachineSetting<S, F> = { [K in keyof MachineSettingInput<S, F>]-?: Exclude<MachineSettingInput<S, F>[K], undefined> };

const settingLimits = [
  ["stitchLength", 5, "Stitch length goes from 0 to 5 mm."],
  ["stitchWidth", 7, "Stitch width goes from 0 to 7 mm."],
  ["tension", 9, "Tension goes from 0 to 9."],
] as const;

// Lengths, widths and tension come in half steps from 0 up to each limit.
// Sets with nothing filled in are dropped, so an empty row never saves.
export function checkMachineSettings<S extends string, F extends string>(
  sets: MachineSettingInput<S, F>[],
): { ok: true; sets: MachineSetting<S, F>[] } | { ok: false; error: string } {
  const checked: MachineSetting<S, F>[] = [];
  for (const set of sets) {
    for (const [field, max, error] of settingLimits) {
      const value = set[field];
      if (value === null || value === undefined) continue;
      if (!Number.isFinite(value) || value < 0 || value > max || !Number.isInteger(value * 2)) return { ok: false, error };
    }
    const tidied: MachineSetting<S, F> = {
      name: set.name?.trim() || null,
      stitch: set.stitch ?? null,
      stitchLength: set.stitchLength ?? null,
      stitchWidth: set.stitchWidth ?? null,
      tension: set.tension ?? null,
      presserFoot: set.presserFoot ?? null,
      notes: set.notes?.trim() || null,
    };
    if (Object.values(tidied).some((value) => value !== null)) checked.push(tidied);
  }
  return { ok: true, sets: checked };
}
