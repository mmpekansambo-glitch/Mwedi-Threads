import { describe, expect, it } from "vitest";
import { checkFabricPhotos, checkFabricSizes, fabricTypeSearch } from "./fabricStash";

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
    expect(checkFabricSizes(1.756, null)).toEqual({ ok: true, amount: 1.76, width: null });
    expect(checkFabricSizes(-1, null).ok).toBe(false);
    expect(checkFabricSizes(null, 1000).ok).toBe(false);
  });
});

describe("fabricTypeSearch", () => {
  it("matches fabric types from three letters", () => {
    expect(fabricTypeSearch("Jer")).toEqual(["jersey"]);
    expect(fabricTypeSearch("co")).toEqual([]);
  });
});
