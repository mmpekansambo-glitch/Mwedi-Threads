import { renameStashYarns } from "./generated/api";
import type { StashYarn } from "./generated/api.schemas";

// Same letters and digits, ignoring capitals, spaces and punctuation; the
// API matches catalog names the same way.
export function nameKey(name: string | null | undefined): string {
  return (name ?? "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type RenameOffer = {
  brand: { from: string; to: string } | null;
  subBrand: { from: string; to: string; brand: string } | null;
  count: number;
};

// After a maker renames a brand or sub brand on one yarn, finds their other
// yarns that still have the old name, so the app can offer to rename those
// too. Colors are never part of the offer.
export function findRenameOffer(before: StashYarn, saved: StashYarn, stash: StashYarn[]): RenameOffer | null {
  const others = stash.filter((yarn) => yarn.id !== saved.id);
  const brandChanged = before.brand !== saved.brand;
  const subChanged = Boolean(before.subBrand && saved.subBrand && before.subBrand !== saved.subBrand);
  const brandMatches = brandChanged
    ? others.filter((yarn) => nameKey(yarn.brand) === nameKey(before.brand) && yarn.brand !== saved.brand)
    : [];
  const subMatches = subChanged
    ? others.filter((yarn) =>
      nameKey(yarn.brand) === nameKey(before.brand)
      && nameKey(yarn.subBrand) === nameKey(before.subBrand)
      && yarn.subBrand !== saved.subBrand)
    : [];
  const count = new Set([...brandMatches, ...subMatches].map((yarn) => yarn.id)).size;
  if (!count) return null;
  return {
    brand: brandMatches.length ? { from: before.brand, to: saved.brand } : null,
    subBrand: subMatches.length ? { from: before.subBrand!, to: saved.subBrand!, brand: saved.brand } : null,
    count,
  };
}

export function renameOfferText(offer: RenameOffer): string {
  const names = [offer.brand && `${offer.brand.from} to ${offer.brand.to}`, offer.subBrand && `${offer.subBrand.from} to ${offer.subBrand.to}`]
    .filter(Boolean)
    .join(" and ");
  const yarns = offer.count === 1 ? "1 other yarn" : `${offer.count} other yarns`;
  return `You have ${yarns} with the old name. Rename ${names} on ${offer.count === 1 ? "it" : "them"} too? Each keeps its own color.`;
}

// Renames the brand first, so the sub brand rename finds the other yarns
// under the brand's new name.
export async function acceptRenameOffer(offer: RenameOffer) {
  if (offer.brand) await renameStashYarns({ field: "brand", ...offer.brand });
  if (offer.subBrand) await renameStashYarns({ field: "subBrand", ...offer.subBrand });
}
