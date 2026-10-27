export const notionCategories = ["zip", "button", "elastic", "thread", "interfacing"] as const;
export const kitCategories = ["machine", "presser_foot", "needle", "scissors", "ruler"] as const;

type Section = "notions" | "kit";

// "Other" fits either section; every other category belongs to one.
export function categoryFits(section: Section, category: string): boolean {
  if (category === "other") return true;
  const fits: readonly string[] = section === "notions" ? notionCategories : kitCategories;
  return fits.includes(category);
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Tool photos live under the owner's own folder, so a tool can only point at
// a photo its owner uploaded.
export function isOwnToolPhoto(ownerId: string, photoPath: string): boolean {
  return new RegExp(`^/objects/sewing-tools/${escapeForRegExp(ownerId)}/[0-9a-f-]{36}$`, "i").test(photoPath);
}
