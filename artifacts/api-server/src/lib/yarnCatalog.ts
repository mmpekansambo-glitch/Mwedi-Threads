export type BlendPart = { fiber: string; percent: number };

// Fibers offered in the blend picker before any maker has added their own.
export const defaultFibers = [
  "Acrylic", "Alpaca", "Bamboo", "Cashmere", "Cotton", "Linen", "Merino",
  "Mohair", "Nylon", "Polyester", "Silk", "Viscose", "Wool",
];

// Names match when they have the same letters and digits, ignoring case,
// spaces and punctuation, so "Lion Brand", "lion-brand" and "Lionbrand" are
// one catalog entry.
export function matchKey(name: string): string {
  return name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function tidyName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

// The catalog name to offer as "Did you mean …?" when what was typed is not
// already in the catalog but is a letter or two away from a name that is.
export function suggestName(typed: string, names: string[]): string | null {
  const key = matchKey(typed);
  if (key.length < 3) return null;
  if (names.some((name) => matchKey(name) === key)) return null;
  const allowed = key.length < 8 ? 1 : 2;
  let best: { name: string; distance: number } | null = null;
  for (const name of names) {
    const distance = editDistance(key, matchKey(name));
    if (distance <= allowed && (!best || distance < best.distance)) best = { name, distance };
  }
  return best?.name ?? null;
}

export type BlendCheck = { ok: true; blend: BlendPart[] } | { ok: false; error: string };

// A blend lists each fiber once and adds up to 100%. Fiber names are
// matched to the known list so "merino" is saved as "Merino".
export function checkBlend(blend: BlendPart[], knownFibers: string[]): BlendCheck {
  if (blend.length === 0) return { ok: true, blend: [] };
  const seen = new Set<string>();
  const tidied: BlendPart[] = [];
  for (const part of blend) {
    const fiber = tidyName(part.fiber);
    const key = matchKey(fiber);
    if (!key) return { ok: false, error: "Choose a fiber for each part of the blend." };
    if (seen.has(key)) return { ok: false, error: "List each fiber in the blend only once." };
    seen.add(key);
    const known = knownFibers.find((name) => matchKey(name) === key);
    tidied.push({ fiber: known ?? fiber, percent: part.percent });
  }
  const total = tidied.reduce((sum, part) => sum + part.percent, 0);
  if (total !== 100) return { ok: false, error: `The blend adds up to ${total}%. Make it add up to 100%.` };
  return { ok: true, blend: tidied };
}

export function isWebLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export type SkeinCheck =
  | { ok: true; skeinsPurchased: number | null; skeinsLeft: number | null }
  | { ok: false; error: string };

// Skeins come in halves at most. Skeins left starts at the number bought and
// can't be more than that.
export function checkSkeins(
  skeinsPurchased: number | null,
  skeinsLeft: number | null,
): SkeinCheck {
  const isHalf = (value: number) => Number.isInteger(value * 2);
  if (skeinsPurchased !== null && !isHalf(skeinsPurchased)) {
    return { ok: false, error: "Enter skeins in whole or half skeins." };
  }
  if (skeinsLeft !== null && !isHalf(skeinsLeft)) {
    return { ok: false, error: "Enter skeins in whole or half skeins." };
  }
  const left = skeinsLeft ?? skeinsPurchased;
  if (left !== null && skeinsPurchased !== null && left > skeinsPurchased) {
    return { ok: false, error: "Skeins left can't be more than skeins purchased." };
  }
  return { ok: true, skeinsPurchased, skeinsLeft: left };
}
