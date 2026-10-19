import { describe, expect, it } from "vitest";
import { CreateProjectBody, PreviewDesignerWebsiteTitleBody, UpdateProjectBody } from "@workspace/api-zod";

describe("Mwedi Threads project contracts", () => {
  it("accepts a project with month-precision dates and structured yarn details", () => {
    const result = CreateProjectBody.safeParse({
      title: "Autumn shawl",
      craft: "crochet",
      startedAt: "2026-09-01",
      startedAtPrecision: "month",
      targetDate: "2026-12-15",
      targetDatePrecision: "day",
      yarns: [
        { brand: "Brooklyn Tweed", subBrand: "Tough Love Sock", color: "Wild Horse", skeinsUsed: 2 },
        { brand: "Brooklyn Tweed", subBrand: "Tough Love Sock", color: "Cardinal", heldTogether: true },
      ],
      designerWebsite: "https://maker.example.org/patterns",
      designerPageTitle: "Maker Pattern Library",
      hookSize: "4.0 mm (US G-6, UK/Canada 8)",
    });

    expect(result.success).toBe(true);
  });

  it("rejects hook sizes that are not in the standard crochet list", () => {
    const result = CreateProjectBody.safeParse({
      title: "Invalid hook size",
      craft: "crochet",
      hookSize: "7.5 mm",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a knitting project with a main and second needle", () => {
    const result = CreateProjectBody.safeParse({
      title: "Ribbed hat",
      craft: "knitting",
      needleSize: "4.0 mm (US 6, UK/Canada 8)",
      needleType: "circular",
      needleCableLength: "40 cm (16 in)",
      secondNeedleSize: "3.25 mm (US 3, UK/Canada 10)",
      secondNeedleType: "double_pointed",
    });

    expect(result.success).toBe(true);
  });

  it("rejects needle sizes, types and cable lengths outside the standard lists", () => {
    for (const fields of [
      { needleSize: "4 mm" },
      { needleType: "bamboo" },
      { needleCableLength: "50 cm" },
      { secondNeedleSize: "US 6" },
    ]) {
      const result = CreateProjectBody.safeParse({ title: "Invalid needle", craft: "knitting", ...fields });
      expect(result.success).toBe(false);
    }
  });

  it("accepts older project clients that omit optional date precision and yarn fields", () => {
    const result = CreateProjectBody.safeParse({
      title: "Legacy project",
      craft: "crochet",
    });

    expect(result.success).toBe(true);
  });

  it("accepts partial edits to date precision and yarn details", () => {
    const result = UpdateProjectBody.safeParse({
      targetDate: "2026-12-01",
      targetDatePrecision: "month",
      yarns: [{ color: "Cardinal" }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects more than 12 yarns, negative skeins and a stash link that isn't an ID", () => {
    for (const yarns of [
      Array.from({ length: 13 }, (_, index) => ({ color: `Color ${index}` })),
      [{ color: "Teal", skeinsUsed: -1 }],
      [{ stashYarnId: "not-an-id" }],
    ]) {
      expect(UpdateProjectBody.safeParse({ yarns }).success).toBe(false);
    }
  });

  it("accepts a valid designer website title preview request", () => {
    const result = PreviewDesignerWebsiteTitleBody.safeParse({
      websiteUrl: "https://maker.example.org/patterns",
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-web links for a designer website", () => {
    const result = CreateProjectBody.safeParse({
      title: "Private socks",
      craft: "knitting",
      designerWebsite: "ftp://maker.example.org/patterns",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported date precision values", () => {
    const result = CreateProjectBody.safeParse({
      title: "Invalid date format",
      craft: "knitting",
      startedAtPrecision: "year",
    });

    expect(result.success).toBe(false);
  });
});
