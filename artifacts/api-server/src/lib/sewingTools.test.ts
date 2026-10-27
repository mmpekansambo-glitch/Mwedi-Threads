import { describe, expect, it } from "vitest";
import { categoryFits, isOwnToolPhoto } from "./sewingTools";

describe("sewing tools", () => {
  it("keeps notions and kit categories in their own section", () => {
    expect(categoryFits("notions", "zip")).toBe(true);
    expect(categoryFits("kit", "zip")).toBe(false);
    expect(categoryFits("kit", "presser_foot")).toBe(true);
    expect(categoryFits("notions", "machine")).toBe(false);
    expect(categoryFits("notions", "other")).toBe(true);
    expect(categoryFits("kit", "other")).toBe(true);
  });

  it("only accepts photos from the owner's own folder", () => {
    const id = "0b6f1c7e-3d0a-4c4e-9c43-2f5a0d1e9b11";
    expect(isOwnToolPhoto("user_a", `/objects/sewing-tools/user_a/${id}`)).toBe(true);
    expect(isOwnToolPhoto("user_a", `/objects/sewing-tools/user_b/${id}`)).toBe(false);
    expect(isOwnToolPhoto("user_a", `/objects/fabric/user_a/${id}`)).toBe(false);
  });
});
