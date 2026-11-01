import type { CareBleach, CareDry, CareDryClean, CareIron, CareWash, StashFabric } from "./generated/api.schemas";

// Laundry care symbols for fabric, drawn for Mwedi Threads on a 48 x 48
// grid. Each shape is a list of strokes (paths) and dots so the web and the
// phone app draw the same symbol from the same data.
export type CareShape = { paths: string[]; dots: Array<[number, number]> };

const tub = ["M5 15 L10 40 H38 L43 15", "M5 15 q4.75 -5 9.5 0 t9.5 0 t9.5 0 t9.5 0"];
const square = ["M6 6 H42 V42 H6 Z"];
const drum = "M11 24 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0";
const iron = ["M7 38 H43 V31 Q43 19 31 19 H16 Q11 19 9 27 Z", "M18 19 V13 H35"];
const cross = "M6 6 L42 42 M42 6 L6 42";
const ring = "M7 24 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0";

function dots(count: number, y: number, centre = 24): Array<[number, number]> {
  return Array.from({ length: count }, (_, place) => [centre + (place - (count - 1) / 2) * 6, y]);
}

export type CareGroupKey = "careWash" | "careBleach" | "careDry" | "careIron" | "careDryClean";

export type CareOption<T extends string = string> = { value: T; label: string; shape: CareShape };

export type CareGroup = { key: CareGroupKey; label: string; options: CareOption[] };

const wash: Array<CareOption<CareWash>> = [
  { value: "machine_30", label: "Machine 30°", shape: { paths: tub, dots: dots(1, 30) } },
  { value: "machine_40", label: "Machine 40°", shape: { paths: tub, dots: dots(2, 30) } },
  { value: "machine_60", label: "Machine 60°", shape: { paths: tub, dots: dots(3, 30) } },
  {
    value: "gentle_30",
    label: "Gentle 30°",
    shape: { paths: ["M5 12 L10 37 H38 L43 12", "M5 12 q4.75 -5 9.5 0 t9.5 0 t9.5 0 t9.5 0", "M10 44 H38"], dots: dots(1, 27) },
  },
  {
    value: "hand",
    label: "Hand wash",
    shape: { paths: [...tub, "M17 33 q-2 -6 2 -9 l0 -8 q2 -2 3 0 v6 v-9 q1.5 -2 3 0 v9 v-7 q1.5 -2 3 0 v8 q1 -3 3 -2 q1 3 -1 7 q-2 5 -7 5 Z"], dots: [] },
  },
  { value: "do_not", label: "Do not wash", shape: { paths: [...tub, cross], dots: [] } },
];

const triangle = "M24 6 L44 41 H4 Z";
const bleach: Array<CareOption<CareBleach>> = [
  { value: "any", label: "Any bleach", shape: { paths: [triangle], dots: [] } },
  { value: "non_chlorine", label: "Non-chlorine only", shape: { paths: [triangle, "M19 38 L28 22 M25 38 L33 25"], dots: [] } },
  { value: "do_not", label: "Do not bleach", shape: { paths: [triangle, "M12 17 L36 41 M36 17 L12 41"], dots: [] } },
];

const dry: Array<CareOption<CareDry>> = [
  { value: "tumble_low", label: "Tumble low", shape: { paths: [...square, drum], dots: dots(1, 24) } },
  { value: "tumble_normal", label: "Tumble normal", shape: { paths: [...square, drum], dots: dots(2, 24) } },
  { value: "do_not_tumble", label: "Do not tumble", shape: { paths: [...square, drum, cross], dots: [] } },
  { value: "line", label: "Line dry", shape: { paths: [...square, "M6 8 Q24 26 42 8"], dots: [] } },
  { value: "flat", label: "Dry flat", shape: { paths: [...square, "M13 24 H35"], dots: [] } },
  { value: "drip", label: "Drip dry", shape: { paths: [...square, "M17 14 V34 M24 14 V34 M31 14 V34"], dots: [] } },
];

const ironing: Array<CareOption<CareIron>> = [
  { value: "low", label: "Iron low", shape: { paths: iron, dots: dots(1, 30, 27) } },
  { value: "medium", label: "Iron medium", shape: { paths: iron, dots: dots(2, 30, 27) } },
  { value: "high", label: "Iron high", shape: { paths: iron, dots: dots(3, 30, 27) } },
  { value: "do_not", label: "Do not iron", shape: { paths: [...iron, "M8 8 L42 42 M42 8 L8 42"], dots: [] } },
];

const dryClean: Array<CareOption<CareDryClean>> = [
  { value: "dry_clean", label: "Dry clean", shape: { paths: [ring], dots: [] } },
  { value: "do_not", label: "Do not dry clean", shape: { paths: [ring, cross], dots: [] } },
];

export const careGroups: CareGroup[] = [
  { key: "careWash", label: "Wash", options: wash },
  { key: "careBleach", label: "Bleach", options: bleach },
  { key: "careDry", label: "Dry", options: dry },
  { key: "careIron", label: "Iron", options: ironing },
  { key: "careDryClean", label: "Dry clean", options: dryClean },
];

export type FabricCare = Pick<StashFabric, CareGroupKey>;

export const noCare: FabricCare = { careWash: null, careBleach: null, careDry: null, careIron: null, careDryClean: null };

export function careFrom(fabric?: Partial<FabricCare> | null): FabricCare {
  return {
    careWash: fabric?.careWash ?? null,
    careBleach: fabric?.careBleach ?? null,
    careDry: fabric?.careDry ?? null,
    careIron: fabric?.careIron ?? null,
    careDryClean: fabric?.careDryClean ?? null,
  };
}

export function hasCare(care: FabricCare): boolean {
  return careGroups.some((group) => care[group.key] !== null);
}

export function careOption(group: CareGroup, value: string | null): CareOption | undefined {
  return value === null ? undefined : group.options.find((option) => option.value === value);
}
