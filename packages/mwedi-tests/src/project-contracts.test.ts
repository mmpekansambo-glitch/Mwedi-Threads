import { describe, expect, it } from "vitest";
import { CreateProjectBody, PreviewDesignerWebsiteTitleBody, UpdateProjectBody } from "@workspace/api-zod";

describe("Mwedi Threads project contracts", () => {
  it("accepts a project with month-precision dates and structured yarn details", () => {
    const result = CreateProjectBody.safeParse({
      title: "Autumn shawl",
      craft: "knitting",
      startedAt: "2026-09-01",
      startedAtPrecision: "month",
      targetDate: "2026-12-15",
      targetDatePrecision: "day",
      yarnBrand: "Brooklyn Tweed",
      yarnType: "Tough Love Sock",
      yarnColor: "Wild Horse",
      designerWebsite: "https://maker.example.org/patterns",
      designerPageTitle: "Maker Pattern Library",
    });

    expect(result.success).toBe(true);
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
      yarnColor: "Cardinal",
    });

    expect(result.success).toBe(true);
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
