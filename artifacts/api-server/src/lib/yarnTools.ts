import { CrochetHookSize, KnittingNeedleSize } from "@workspace/api-zod";

type Section = "hooks" | "needles" | "notions";

export type YarnToolFields = {
  section: Section;
  size: string | null;
  needleType: string | null;
  cableLength: string | null;
  material: string | null;
  notionType: string | null;
};

const hookSizes: readonly string[] = Object.values(CrochetHookSize);
const needleSizes: readonly string[] = Object.values(KnittingNeedleSize);
const needleHasCable = (type: string | null) => type === "circular" || type === "interchangeable";

// Each section keeps only the fields that belong to it: hooks and needles need
// a size from the project lists, needles keep a cable length only when they
// have a cable, and notions need a type. Returns the tidied fields, or the
// message to show when something required is missing.
export function shapeYarnTool(fields: YarnToolFields): YarnToolFields | string {
  if (fields.section === "notions") {
    if (!fields.notionType) return "Choose what kind of notion this is.";
    return { ...fields, size: null, needleType: null, cableLength: null };
  }
  const sizes = fields.section === "hooks" ? hookSizes : needleSizes;
  if (!fields.size || !sizes.includes(fields.size)) return "Choose a size.";
  if (fields.section === "hooks") {
    return { ...fields, needleType: null, cableLength: null, notionType: null };
  }
  return { ...fields, cableLength: needleHasCable(fields.needleType) ? fields.cableLength : null, notionType: null };
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Tool photos live under the owner's own folder, so a tool can only point at
// a photo its owner uploaded.
export function isOwnYarnToolPhoto(ownerId: string, photoPath: string): boolean {
  return new RegExp(`^/objects/yarn-tools/${escapeForRegExp(ownerId)}/[0-9a-f-]{36}$`, "i").test(photoPath);
}
