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
