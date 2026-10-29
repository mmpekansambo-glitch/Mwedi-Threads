import { describe, expect, it } from "vitest";
import { amountAfter, checkFabricPhotos, checkFabricSizes, fabricName, fabricTypeSearch } from "./fabricStash";

const owner = "user_123";
const upload = (id: string) => `/objects/fabric/${owner}/${id.padEnd(36, "0")}`;

describe("checkFabricPhotos", () => {
  it("keeps existing photos by place and accepts the owner's new uploads", () => {
    const current = [upload("a"), upload("b")];
    expect(checkFabricPhotos(owner, ["keep:1", upload("c")], current)).toEqual({ ok: true, photoPaths: [upload("b"), upload("c")] });
  });

  it("refuses an empty list, a missing kept photo and another maker's upload", () => {
    expect(checkFabricPhotos(owner, [], []).ok).toBe(false);
    expect(checkFabricPhotos(owner, ["keep:2"], [upload("a")]).ok).toBe(false);
    expect(checkFabricPhotos(owner, ["/objects/fabric/someone/" + "0".repeat(36)], []).ok).toBe(false);
    expect(checkFabricPhotos(owner, [upload("a"), upload("a")], []).ok).toBe(false);
  });
});

describe("checkFabricSizes", () => {
  it("rounds to two decimals and refuses amounts outside 0 to 999", () => {
    expect(checkFabricSizes(1.756, null)).toEqual({ ok: true, amount: 1.76, width: null, amountLeft: null });
    expect(checkFabricSizes(-1, null).ok).toBe(false);
    expect(checkFabricSizes(null, 1000).ok).toBe(false);
  });

  it("keeps amount left within amount bought", () => {
    expect(checkFabricSizes(2, null, 1.5)).toEqual({ ok: true, amount: 2, width: null, amountLeft: 1.5 });
    expect(checkFabricSizes(2, null, 2.5)).toEqual({ ok: false, error: "Amount left can't be more than amount bought." });
    expect(checkFabricSizes(null, null, 1)).toEqual({ ok: false, error: "Enter how much you bought first." });
  });
});

describe("fabric names and amounts", () => {
  it("names a piece by its print and type", () => {
    expect(fabricName({ fabricType: "cotton", print: "floral" })).toBe("Floral cotton");
    expect(fabricName({ fabricType: "french_terry", print: "solid" })).toBe("French terry");
    expect(fabricName({ fabricType: "rib_knit", print: null })).toBe("Rib knit");
  });

  it("takes what was used off what's left, never below zero", () => {
    expect(amountAfter(3, 1.25)).toBe(1.75);
    expect(amountAfter(1, 1.5)).toBe(0);
  });
});

describe("fabricTypeSearch", () => {
  it("matches fabric types from three letters", () => {
    expect(fabricTypeSearch("Jer")).toEqual(["jersey"]);
    expect(fabricTypeSearch("co")).toEqual([]);
  });
});
