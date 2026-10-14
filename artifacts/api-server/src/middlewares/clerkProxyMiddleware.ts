/**
 * Proxies Clerk Frontend API requests through the app's own domain in
 * production. Authentication provider settings are managed through Replit's
 * Auth pane.
 */
import type { IncomingHttpHeaders } from "http";
import type { RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

function normalizeHostname(value: string): string | undefined {
  const candidate = value.trim();
  if (!candidate || /[\\/@?#\s]/.test(candidate)) return undefined;

  try {
    return new URL(`http://${candidate}`).hostname.toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

function getConfiguredClerkHosts(): Set<string> {
  const configuredHosts = [
    process.env.REPLIT_DOMAINS,
    process.env.REPLIT_DEV_DOMAIN,
  ];

  return new Set(
    configuredHosts
      .flatMap((value) => value?.split(",") ?? [])
      .map(normalizeHostname)
      .filter((hostname): hostname is string => Boolean(hostname)),
  );
}

export function getClerkProxyHost(req: {
  headers: IncomingHttpHeaders;
}): string | undefined {
  const trustedHosts = getConfiguredClerkHosts();
  const forwarded = req.headers["x-forwarded-host"];
  const forwardedValues = Array.isArray(forwarded) ? forwarded : [forwarded];
  const host = req.headers.host;
  const hostValues = Array.isArray(host) ? host : [host];
  const candidates = [
    ...forwardedValues.flatMap((value) => value?.split(",") ?? []),
    ...hostValues,
  ];

  for (const candidate of candidates) {
    const hostname = candidate && normalizeHostname(candidate);
    if (hostname && trustedHosts.has(hostname)) return hostname;
  }

  return undefined;
}

export function clerkProxyMiddleware(): RequestHandler {
  if (process.env.NODE_ENV !== "production" || !process.env.CLERK_SECRET_KEY) {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  return createProxyMiddleware({
    target: CLERK_FAPI,
    changeOrigin: true,
    selfHandleResponse: true,
    pathRewrite: (path: string) =>
      path.replace(new RegExp(`^${CLERK_PROXY_PATH}`), ""),
    on: {
      proxyReq: (proxyReq, req) => {
        const protocol = req.headers["x-forwarded-proto"] || "https";
        const host = getClerkProxyHost(req) || "";
        proxyReq.setHeader(
          "Clerk-Proxy-Url",
          `${protocol}://${host}${CLERK_PROXY_PATH}`,
        );
        proxyReq.setHeader("Clerk-Secret-Key", secretKey);

        const forwardedFor = req.headers["x-forwarded-for"];
        const clientIp =
          (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
            ?.split(",")[0]
            ?.trim() ||
          req.socket?.remoteAddress ||
          "";
        if (clientIp) proxyReq.setHeader("X-Forwarded-For", clientIp);
      },
      proxyRes: (proxyRes, req, res) => {
        const headers = { ...proxyRes.headers };
        delete headers["transfer-encoding"];
        delete headers.connection;
        delete headers["keep-alive"];

        const status = proxyRes.statusCode ?? 502;
        if (status < 200 || status === 204) delete headers["content-length"];
        const bodyless =
          req.method === "HEAD" ||
          status < 200 ||
          status === 204 ||
          status === 304;

        if (headers["content-length"] !== undefined || bodyless) {
          res.writeHead(status, headers);
          proxyRes.on("error", () => res.destroy());
          proxyRes.pipe(res);
          return;
        }

        const chunks: Buffer[] = [];
        proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on("end", () => {
          const body = Buffer.concat(chunks);
          headers["content-length"] = String(body.length);
          res.writeHead(status, headers);
          res.end(body);
        });
        proxyRes.on("error", () => {
          if (!res.headersSent) res.writeHead(502, { "content-length": "0" });
          res.end();
        });
      },
    },
  }) as RequestHandler;
}
