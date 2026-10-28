import { describe, expect, it } from "vitest";
import { isOwnYarnToolPhoto, shapeYarnTool } from "./yarnTools";

const empty = { size: null, needleType: null, cableLength: null, material: null, notionType: null };

describe("yarn tools", () => {
  it("needs a size from the right list for hooks and needles", () => {
    expect(shapeYarnTool({ ...empty, section: "hooks" })).toBe("Choose a size.");
    expect(shapeYarnTool({ ...empty, section: "hooks", size: "4.0 mm (US 6, UK/Canada 8)" })).toBe("Choose a size.");
    expect(shapeYarnTool({ ...empty, section: "hooks", size: "4.0 mm (US G-6, UK/Canada 8)" })).toMatchObject({ size: "4.0 mm (US G-6, UK/Canada 8)" });
    expect(shapeYarnTool({ ...empty, section: "needles", size: "4.0 mm (US 6, UK/Canada 8)" })).toMatchObject({ size: "4.0 mm (US 6, UK/Canada 8)" });
  });

  it("drops fields that don't belong to the section", () => {
    expect(shapeYarnTool({ section: "hooks", size: "5.0 mm (US H-8, UK/Canada 6)", needleType: "circular", cableLength: "80 cm (32 in)", material: "bamboo", notionType: "scissors" }))
      .toEqual({ section: "hooks", size: "5.0 mm (US H-8, UK/Canada 6)", needleType: null, cableLength: null, material: "bamboo", notionType: null });
    expect(shapeYarnTool({ ...empty, section: "needles", size: "5.0 mm (US 8, UK/Canada 6)", needleType: "straight", cableLength: "80 cm (32 in)" }))
      .toMatchObject({ needleType: "straight", cableLength: null });
    expect(shapeYarnTool({ ...empty, section: "needles", size: "5.0 mm (US 8, UK/Canada 6)", needleType: "circular", cableLength: "80 cm (32 in)" }))
      .toMatchObject({ cableLength: "80 cm (32 in)" });
    expect(shapeYarnTool({ ...empty, section: "notions", size: "5.0 mm (US 8, UK/Canada 6)", notionType: "stitch_markers" }))
      .toMatchObject({ size: null, notionType: "stitch_markers" });
  });

  it("needs a type for notions", () => {
    expect(shapeYarnTool({ ...empty, section: "notions" })).toBe("Choose what kind of notion this is.");
  });

  it("only accepts photos from the owner's own folder", () => {
    const id = "0b6f1c7e-3d0a-4c4e-9c43-2f5a0d1e9b11";
    expect(isOwnYarnToolPhoto("user_a", `/objects/yarn-tools/user_a/${id}`)).toBe(true);
    expect(isOwnYarnToolPhoto("user_a", `/objects/yarn-tools/user_b/${id}`)).toBe(false);
    expect(isOwnYarnToolPhoto("user_a", `/objects/sewing-tools/user_a/${id}`)).toBe(false);
  });
});
