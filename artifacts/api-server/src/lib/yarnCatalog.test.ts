import { describe, expect, it } from "vitest";
import { checkBlend, checkSkeins, matchKey, suggestName } from "./yarnCatalog";

describe("matchKey", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(matchKey("Lion Brand")).toBe(matchKey("lionbrand"));
    expect(matchKey("Wool-Ease")).toBe(matchKey("wool ease"));
  });
});

describe("suggestName", () => {
  const brands = ["Lion Brand", "Cascade", "Malabrigo"];
  it("offers the closest catalog name for a typo", () => {
    expect(suggestName("Lion Brnad", brands)).toBe("Lion Brand");
    expect(suggestName("Cascde", brands)).toBe("Cascade");
  });
  it("stays quiet for exact matches, new names and very short text", () => {
    expect(suggestName("lion brand", brands)).toBeNull();
    expect(suggestName("Drops", brands)).toBeNull();
    expect(suggestName("Li", brands)).toBeNull();
  });
});

describe("checkBlend", () => {
  it("matches fibers to the known list and needs 100%", () => {
    expect(checkBlend([{ fiber: "merino", percent: 100 }], ["Merino"])).toEqual({ ok: true, blend: [{ fiber: "Merino", percent: 100 }] });
    expect(checkBlend([{ fiber: "Wool", percent: 50 }], ["Wool"]).ok).toBe(false);
    expect(checkBlend([{ fiber: "Wool", percent: 50 }, { fiber: "wool", percent: 50 }], ["Wool"]).ok).toBe(false);
    expect(checkBlend([], [])).toEqual({ ok: true, blend: [] });
  });
});

describe("checkSkeins", () => {
  it("starts skeins left at skeins purchased and allows halves", () => {
    expect(checkSkeins(4, null)).toEqual({ ok: true, skeinsPurchased: 4, skeinsLeft: 4 });
    expect(checkSkeins(4, 2.5)).toEqual({ ok: true, skeinsPurchased: 4, skeinsLeft: 2.5 });
    expect(checkSkeins(4, 5).ok).toBe(false);
    expect(checkSkeins(1.3, null).ok).toBe(false);
  });
});
