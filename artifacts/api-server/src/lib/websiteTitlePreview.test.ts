import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLookup, mockHttpRequest, mockHttpsRequest } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
  mockHttpRequest: vi.fn(),
  mockHttpsRequest: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({ lookup: mockLookup }));
vi.mock("node:http", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:http")>(),
  request: mockHttpRequest,
}));
vi.mock("node:https", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:https")>(),
  request: mockHttpsRequest,
}));

import {
  extractPageTitle,
  inferDesignerName,
  isPublicIpAddress,
  normalizeDesignerPageTitle,
  previewWebsitePageTitle,
} from "./websiteTitlePreview";

type MockResponse = EventEmitter & {
  statusCode: number;
  headers: Record<string, string>;
  resume: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function createResponse(
  statusCode = 200,
  headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" },
): MockResponse {
  return Object.assign(new EventEmitter(), {
    statusCode,
    headers,
    resume: vi.fn(),
    destroy: vi.fn(),
  });
}

function mockResponse(response: MockResponse) {
  const implementation = (_url: URL, _options: unknown, onResponse: (response: MockResponse) => void) => {
    const request = Object.assign(new EventEmitter(), {
      end: () => queueMicrotask(() => onResponse(response)),
      destroy: (error?: Error) => {
        if (error) queueMicrotask(() => request.emit("error", error));
        return request;
      },
    });
    return request;
  };
  mockHttpRequest.mockImplementation(implementation);
  mockHttpsRequest.mockImplementation(implementation);
}

function mockHtmlResponse(html: string) {
  const response = createResponse();
  const implementation = (_url: URL, _options: unknown, onResponse: (response: MockResponse) => void) => {
    const request = Object.assign(new EventEmitter(), {
      end: () => queueMicrotask(() => {
        onResponse(response);
        response.emit("data", Buffer.from(html));
        response.emit("end");
      }),
      destroy: (error?: Error) => {
        if (error) queueMicrotask(() => request.emit("error", error));
        return request;
      },
    });
    return request;
  };
  mockHttpRequest.mockImplementation(implementation);
  mockHttpsRequest.mockImplementation(implementation);
}

function mockTimedOutRequest() {
  const implementation = () => {
    const request = Object.assign(new EventEmitter(), {
      end: () => queueMicrotask(() => request.emit("timeout")),
      destroy: (error?: Error) => {
        if (error) queueMicrotask(() => request.emit("error", error));
        return request;
      },
    });
    return request;
  };
  mockHttpRequest.mockImplementation(implementation);
  mockHttpsRequest.mockImplementation(implementation);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("designer website title preview", () => {
  it("extracts and decodes the HTML title", () => {
    expect(extractPageTitle("<html><head><title>  Knit &amp; Crochet&nbsp; Notes </title></head></html>"))
      .toBe("Knit & Crochet Notes");
  });

  it("returns null when the page has no title", () => {
    expect(extractPageTitle("<html><head></head><body>Pattern archive</body></html>")).toBeNull();
    expect(extractPageTitle("<title>   </title>")).toBeNull();
  });

  it("keeps the main pattern name and removes beginner/free marketing words", () => {
    expect(normalizeDesignerPageTitle(
      "Free Beginner Knitting Pattern: Meadow Cardigan | Maker's Blog",
    )).toBe("Meadow Cardigan");
    expect(normalizeDesignerPageTitle("Beginner-friendly free crochet pattern")).toBeNull();
  });

  it("selects a pattern name after a generic SEO phrase and removes the designer byline", () => {
    expect(normalizeDesignerPageTitle(
      "Free Beginner Crochet Cardigan Pattern - Triple Tie Cardigan by Cozy Nooks Desgin",
    )).toBe("Triple Tie Cardigan");
  });

  it("shortens long page titles at a word boundary", () => {
    const title = normalizeDesignerPageTitle(
      "A Beautiful Hand Knit Sweater Pattern With Lots Of Details That Do Not Help Identify The Project And Keep Going For Quite A While",
    );
    expect(title).not.toBeNull();
    expect(title!.length).toBeLessThanOrEqual(72);
    expect(title).toMatch(/…$/);
  });

  it("uses site metadata before falling back to a humanized website name", () => {
    expect(inferDesignerName(
      '<meta content="Tin &amp; Thread" property="og:site_name">',
      "www.example.org",
    )).toBe("Tin & Thread");
    expect(inferDesignerName("", "www.tin-can-knits.com")).toBe("Tin Can Knits");
  });

  it("returns the concise project name and inferred designer label from a preview", async () => {
    mockHtmlResponse(
      '<html><head><meta content="Maker &amp; Co." property="og:site_name"><title>Free Beginner Knitting Pattern: Meadow Cardigan | Maker &amp; Co.</title></head></html>',
    );

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .resolves.toEqual({
        websiteUrl: "https://designer.example/",
        pageTitle: "Meadow Cardigan",
        designerName: "Maker & Co.",
      });
  });

  it("allows public addresses and blocks private or reserved address ranges", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2001:4860:4860::8888")).toBe(true);
    expect(isPublicIpAddress("10.0.0.1")).toBe(false);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("169.254.1.1")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
    expect(isPublicIpAddress("64:ff9b::a00:1")).toBe(false);
  });

  it("rejects local addresses and non-web protocols before making a request", async () => {
    await expect(previewWebsitePageTitle("http://127.0.0.1")).rejects.toMatchObject({ statusCode: 400 });
    await expect(previewWebsitePageTitle("file:///etc/passwd")).rejects.toMatchObject({ statusCode: 400 });
    expect(mockHttpRequest).not.toHaveBeenCalled();
  });

  it("rejects DNS answers containing both public and private addresses before making a request", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.8", family: 4 },
    ]);

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .rejects.toMatchObject({ statusCode: 400 });

    expect(mockLookup).toHaveBeenCalledOnce();
    expect(mockHttpsRequest).not.toHaveBeenCalled();
    expect(mockHttpRequest).not.toHaveBeenCalled();
  });

  it("rejects mixed DNS answers when the private address is IPv6 before making a request", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "fc00::1", family: 6 },
    ]);

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .rejects.toMatchObject({ statusCode: 400 });

    expect(mockLookup).toHaveBeenCalledOnce();
    expect(mockHttpsRequest).not.toHaveBeenCalled();
    expect(mockHttpRequest).not.toHaveBeenCalled();
  });

  it("refuses redirects without requesting the private redirect destination", async () => {
    const response = createResponse(302, {
      location: "http://internal.example/private",
      "content-type": "text/html",
    });
    mockResponse(response);
    mockLookup.mockImplementation(async (hostname: string) => [
      {
        address: hostname === "internal.example" ? "10.0.0.8" : "93.184.216.34",
        family: 4,
      },
    ]);

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .rejects.toMatchObject({
        statusCode: 502,
        message: "Could not load the page title. Check the link and try again.",
      });

    expect(mockLookup).toHaveBeenCalledTimes(1);
    expect(mockHttpsRequest).toHaveBeenCalledTimes(1);
    expect(mockHttpRequest).not.toHaveBeenCalled();
    expect(response.resume).toHaveBeenCalledOnce();
  });

  it("returns a successful empty title when the HTML page has no title", async () => {
    mockHtmlResponse("<html><body>No title</body></html>");

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .resolves.toEqual({
        websiteUrl: "https://designer.example/",
        pageTitle: null,
        designerName: "Designer",
      });
  });

  it("returns a useful error for non-HTML responses", async () => {
    const response = createResponse(200, { "content-type": "application/pdf" });
    mockResponse(response);

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .rejects.toMatchObject({
        statusCode: 502,
        message: "Could not load the page title. Check the link and try again.",
      });
    expect(response.resume).toHaveBeenCalledOnce();
  });

  it("rejects pages larger than the response-size limit", async () => {
    const response = createResponse();
    const implementation = (_url: URL, _options: unknown, onResponse: (response: MockResponse) => void) => {
      const request = Object.assign(new EventEmitter(), {
        end: () => queueMicrotask(() => {
          onResponse(response);
          response.emit("data", Buffer.alloc(1_000_001, 97));
        }),
        destroy: vi.fn(),
      });
      return request;
    };
    mockHttpRequest.mockImplementation(implementation);
    mockHttpsRequest.mockImplementation(implementation);

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .rejects.toMatchObject({
        statusCode: 502,
        message: "Could not load the page title. Check the link and try again.",
      });
    expect(response.destroy).toHaveBeenCalledOnce();
  });

  it("returns a useful error when the request times out", async () => {
    mockTimedOutRequest();

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .rejects.toMatchObject({
        statusCode: 502,
        message: "Could not load the page title. Check the link and try again.",
      });
    expect(mockHttpsRequest).toHaveBeenCalledOnce();
  });
});
