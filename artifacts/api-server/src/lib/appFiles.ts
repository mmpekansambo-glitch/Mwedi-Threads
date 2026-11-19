// Off Replit, one server answers everything: the API at /api, the phone app
// files for Expo Go at /mobile/, and the website everywhere else. On Replit
// those are separate services, so this only switches on with
// SERVE_APP_FILES=true (set on Railway).
//
// Paths are relative to the folder the server starts in (the repo root on
// Railway) and can be changed with WEB_DIST_DIR and MOBILE_BUILD_DIR.
import express, { type Express, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger";

const MOBILE_PATH = "/mobile";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toScriptString(value: string) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

function publicHost(req: Request) {
  const forwarded = req.headers["x-forwarded-host"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || req.headers.host || "";
}

export function mobileHandler(buildDir: string, templatePath: string, appName: string) {
  const template = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf-8") : null;
  const files = express.static(buildDir, { index: false, fallthrough: false });

  return (req: Request, res: Response, next: (error?: unknown) => void) => {
    const pathname = req.path;
    if (pathname === "/" || pathname === "/manifest") {
      const platform = req.headers["expo-platform"];
      if (platform === "ios" || platform === "android") {
        const manifestPath = path.join(buildDir, platform, "manifest.json");
        if (!fs.existsSync(manifestPath)) {
          res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
          return;
        }
        res.set({ "content-type": "application/json", "expo-protocol-version": "1", "expo-sfv-version": "0" });
        res.send(fs.readFileSync(manifestPath, "utf-8"));
        return;
      }
      if (pathname === "/" && template) {
        const host = publicHost(req);
        const protocol = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] || "https";
        const expsUrl = `exps://${host}${MOBILE_PATH}`;
        res.type("html").send(
          template
            .replace(/BASE_URL_PLACEHOLDER/g, `${protocol}://${host}`)
            .replace(/EXPS_URL_ATTRIBUTE_PLACEHOLDER/g, escapeHtml(expsUrl))
            .replace(/EXPS_URL_JSON_PLACEHOLDER/g, toScriptString(expsUrl))
            .replace(/APP_NAME_PLACEHOLDER/g, escapeHtml(appName)),
        );
        return;
      }
    }
    files(req, res, (error?: unknown) => {
      if (error && (error as { status?: number }).status === 404) {
        res.status(404).send("Not Found");
        return;
      }
      next(error);
    });
  };
}

export function serveAppFiles(app: Express, env: NodeJS.ProcessEnv = process.env) {
  if (env.SERVE_APP_FILES !== "true") return;

  const webDir = path.resolve(env.WEB_DIST_DIR ?? "artifacts/indigoloom-web/dist/public");
  const mobileRoot = path.resolve(env.MOBILE_APP_DIR ?? "artifacts/indigoloom-mobile");
  const mobileBuildDir = path.resolve(env.MOBILE_BUILD_DIR ?? path.join(mobileRoot, "static-build"));

  if (fs.existsSync(mobileBuildDir)) {
    let appName = "Mwedi Threads";
    try {
      appName = JSON.parse(fs.readFileSync(path.join(mobileRoot, "app.json"), "utf-8")).expo?.name ?? appName;
    } catch {
      // Keep the default name.
    }
    const handler = mobileHandler(mobileBuildDir, path.join(mobileRoot, "server/templates/landing-page.html"), appName);
    app.use(MOBILE_PATH, (req, res, next) => {
      // Expo Go and the landing page expect /mobile/ with the slash.
      if (req.originalUrl === MOBILE_PATH) {
        res.redirect(301, `${MOBILE_PATH}/`);
        return;
      }
      handler(req, res, next);
    });
  } else {
    logger.warn({ mobileBuildDir }, "No phone app build found; /mobile/ is off");
  }

  if (!fs.existsSync(path.join(webDir, "index.html"))) {
    logger.warn({ webDir }, "No website build found; only the API is served");
    return;
  }
  app.use(express.static(webDir, { index: false }));
  // Any other page is the website's own route, so it gets index.html.
  app.get(/^(?!\/api(\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(webDir, "index.html"));
  });
}
