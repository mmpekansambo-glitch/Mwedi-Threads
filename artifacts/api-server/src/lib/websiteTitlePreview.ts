import { lookup } from "node:dns/promises";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

type ResolvedAddress = { address: string; family: 4 | 6 };

const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();
const blockedIpv4Ranges = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const;
const blockedIpv6Ranges = [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const;

for (const [network, prefix] of blockedIpv4Ranges) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of blockedIpv6Ranges) {
  blockedIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

export class WebsiteTitlePreviewError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 502,
  ) {
    super(message);
    this.name = "WebsiteTitlePreviewError";
  }
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4Addresses.check(address, "ipv4");
  if (family === 6) return !blockedIpv6Addresses.check(address, "ipv6");
  return false;
}

export function extractPageTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  if (!match) return null;

  const decoded = match[1]
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[\da-f]+|\d+);?/gi, (_entity, code: string) => {
      const value = code[0]?.toLowerCase() === "x"
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isInteger(value) && value > 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : "";
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash|rsquo|lsquo|rdquo|ldquo);/gi, (entity, name: string) => {
      const entities: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
        ndash: "–",
        mdash: "—",
        rsquo: "’",
        lsquo: "‘",
        rdquo: "”",
        ldquo: "“",
      };
      return entities[name.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();

  return decoded ? decoded.slice(0, 300) : null;
}

function parseWebsiteUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new WebsiteTitlePreviewError("Enter a valid public website link.", 400);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const isLocalHost =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test");

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.port.length > 0 ||
    !hostname ||
    isIP(hostname) !== 0 ||
    isLocalHost
  ) {
    throw new WebsiteTitlePreviewError("Only public HTTP or HTTPS websites can be previewed.", 400);
  }

  url.hash = "";
  return url;
}

function getHtml(url: URL, addresses: ResolvedAddress[]): Promise<string> {
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    const matches = addresses.filter(({ family }) => !options.family || family === options.family);
    if (matches.length === 0) {
      callback(new Error("No public address is available for this website.") as NodeJS.ErrnoException, "", 0);
      return;
    }
    if (options.all) {
      callback(null, matches.map(({ address, family }) => ({ address, family })));
      return;
    }
    const selected = matches[0];
    callback(null, selected.address, selected.family);
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let receivedBytes = 0;
    const chunks: Buffer[] = [];
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const handleResponse = (response: import("node:http").IncomingMessage) => {
      if (response.statusCode !== 200) {
        response.resume();
        fail(new Error("The website did not return a successful page."));
        return;
      }

      const contentType = response.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
      if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
        response.resume();
        fail(new Error("The website did not return an HTML page."));
        return;
      }

      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.byteLength;
        if (receivedBytes > 1_000_000) {
          response.destroy();
          fail(new Error("The website response is too large."));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => {
        if (settled) return;
        settled = true;
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
      response.on("error", fail);
    };

    const options = {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Encoding": "identity",
        "User-Agent": "MwediThreadsPageTitlePreview/1.0",
      },
      maxHeaderSize: 16_384,
      lookup: pinnedLookup,
      timeout: 6_000,
    };

    const request = url.protocol === "https:"
      ? httpsRequest(url, options, handleResponse)
      : httpRequest(url, options, handleResponse);
    request.on("timeout", () => request.destroy(new Error("Website preview timed out.")));
    request.on("error", fail);
    request.end();
  });
}

export async function previewWebsitePageTitle(websiteUrl: string): Promise<{
  websiteUrl: string;
  pageTitle: string | null;
}> {
  const url = parseWebsiteUrl(websiteUrl);
  let addresses: ResolvedAddress[];
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true }) as ResolvedAddress[];
  } catch {
    throw new WebsiteTitlePreviewError("That public website could not be reached.", 502);
  }

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new WebsiteTitlePreviewError("Only public websites can be previewed.", 400);
  }

  try {
    const html = await getHtml(url, addresses);
    return { websiteUrl: url.toString(), pageTitle: extractPageTitle(html) };
  } catch {
    throw new WebsiteTitlePreviewError("Could not load the page title. Check the link and try again.", 502);
  }
}
