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
  isPublicIpAddress,
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
    const response = createResponse();
    const implementation = (_url: URL, _options: unknown, onResponse: (response: MockResponse) => void) => {
      const request = Object.assign(new EventEmitter(), {
        end: () => queueMicrotask(() => {
          onResponse(response);
          response.emit("data", Buffer.from("<html><body>No title</body></html>"));
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

    await expect(previewWebsitePageTitle("https://designer.example/"))
      .resolves.toEqual({
        websiteUrl: "https://designer.example/",
        pageTitle: null,
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
