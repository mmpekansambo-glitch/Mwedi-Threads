import { describe, expect, it } from "vitest";
import {
  extractPageTitle,
  isPublicIpAddress,
  previewWebsitePageTitle,
} from "./websiteTitlePreview";

describe("designer website title preview", () => {
  it("extracts and decodes the HTML title", () => {
    expect(extractPageTitle("<html><head><title>  Knit &amp; Crochet&nbsp; Notes </title></head></html>"))
      .toBe("Knit & Crochet Notes");
  });

  it("returns null when the page has no title", () => {
    expect(extractPageTitle("<html><head></head><body>Pattern archive</body></html>")).toBeNull();
    expect(extractPageTitle("<title>   </title>")).toBeNull();
  });

  it("allows public addresses and blocks private or reserved address ranges", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2001:4860:4860::8888")).toBe(true);
    expect(isPublicIpAddress("10.0.0.1")).toBe(false);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("169.254.1.1")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
  });

  it("rejects local addresses and non-web protocols before making a request", async () => {
    await expect(previewWebsitePageTitle("http://127.0.0.1")).rejects.toMatchObject({ statusCode: 400 });
    await expect(previewWebsitePageTitle("file:///etc/passwd")).rejects.toMatchObject({ statusCode: 400 });
  });
});
