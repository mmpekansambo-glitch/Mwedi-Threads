const fabricTypes = ["cotton", "linen", "jersey", "denim", "silk", "wool", "polyester", "blend", "other"] as const;

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Fabric photos live under the owner's own folder, so a fabric can only
// point at photos its owner uploaded.
export function isOwnFabricPhoto(ownerId: string, photoPath: string): boolean {
  return new RegExp(`^/objects/fabric/${escapeForRegExp(ownerId)}/[0-9a-f-]{36}$`, "i").test(photoPath);
}

type PhotosCheck = { ok: true; photoPaths: string[] } | { ok: false; error: string };

// The app sends the photo list in order: "keep:<index>" keeps a photo the
// fabric already has, anything else is a newly uploaded photo path.
export function checkFabricPhotos(ownerId: string, sent: string[], current: string[]): PhotosCheck {
  if (sent.length === 0) return { ok: false, error: "Add a photo of the print." };
  if (sent.length > 4) return { ok: false, error: "Add up to four photos." };
  const photoPaths: string[] = [];
  for (const item of sent) {
    const kept = /^keep:([0-3])$/.exec(item);
    const path = kept ? current[Number(kept[1])] : item;
    if (!path || (!kept && !isOwnFabricPhoto(ownerId, path))) {
      return { ok: false, error: "One of the photos didn't upload. Please add it again." };
    }
    if (photoPaths.includes(path)) return { ok: false, error: "That photo is already on this fabric." };
    photoPaths.push(path);
  }
  return { ok: true, photoPaths };
}

type SizesCheck =
  | { ok: true; amount: number | null; width: number | null; amountLeft: number | null }
  | { ok: false; error: string };

// Amounts are kept to two decimals, like 1.75 meters. What's left can't be
// more than was bought.
export function checkFabricSizes(amount: number | null, width: number | null, amountLeft: number | null = null): SizesCheck {
  for (const value of [amount, width, amountLeft]) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 999)) {
      return { ok: false, error: "Enter amounts between 0 and 999." };
    }
  }
  const round = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);
  if (amountLeft !== null && amount === null) return { ok: false, error: "Enter how much you bought first." };
  if (amountLeft !== null && amount !== null && round(amountLeft)! > round(amount)!) {
    return { ok: false, error: "Amount left can't be more than amount bought." };
  }
  return { ok: true, amount: round(amount), width: round(width), amountLeft: round(amountLeft) };
}

// Searching "cotton" or "Jersey" also finds fabric by its type.
export function fabricTypeSearch(search: string): string[] {
  const typed = search.trim().toLowerCase();
  return typed.length < 3 ? [] : fabricTypes.filter((type) => type.startsWith(typed));
}

