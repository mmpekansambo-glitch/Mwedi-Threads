import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveAppFiles } from "./appFiles";

let base = "";
let close = () => {};

beforeAll(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "app-files-"));
  const web = path.join(root, "web");
  const mobile = path.join(root, "mobile");
  fs.mkdirSync(web);
  fs.writeFileSync(path.join(web, "index.html"), "<html>website</html>");
  fs.writeFileSync(path.join(web, "logo.svg"), "<svg/>");
  fs.mkdirSync(path.join(mobile, "static-build", "ios"), { recursive: true });
  fs.writeFileSync(path.join(mobile, "static-build", "ios", "manifest.json"), '{"id":"ios"}');
  fs.mkdirSync(path.join(mobile, "server", "templates"), { recursive: true });
  fs.writeFileSync(path.join(mobile, "server", "templates", "landing-page.html"), "<a href=\"EXPS_URL_ATTRIBUTE_PLACEHOLDER\">APP_NAME_PLACEHOLDER</a>");
  fs.writeFileSync(path.join(mobile, "app.json"), '{"expo":{"name":"Mwedi Threads"}}');

  const app = express();
  app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));
  serveAppFiles(app, { SERVE_APP_FILES: "true", WEB_DIST_DIR: web, MOBILE_APP_DIR: mobile });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});

afterAll(() => close());

describe("one server for the API, website and phone app", () => {
  it("serves website pages and files, leaving /api alone", async () => {
    expect(await (await fetch(`${base}/projects/123`)).text()).toBe("<html>website</html>");
    expect(await (await fetch(`${base}/logo.svg`)).text()).toBe("<svg/>");
    expect((await fetch(`${base}/api/missing`)).status).toBe(404);
    expect(await (await fetch(`${base}/api/healthz`)).json()).toEqual({ status: "ok" });
  });

  it("gives Expo Go the phone app manifest and people the landing page", async () => {
    const manifest = await fetch(`${base}/mobile/`, { headers: { "expo-platform": "ios" } });
    expect(manifest.headers.get("expo-protocol-version")).toBe("1");
    expect(await manifest.json()).toEqual({ id: "ios" });

    const landing = await fetch(`${base}/mobile/`, { headers: { "x-forwarded-host": "mwedi.up.railway.app" } });
    expect(await landing.text()).toBe('<a href="exps://mwedi.up.railway.app/mobile">Mwedi Threads</a>');

    const bare = await fetch(`${base}/mobile`, { redirect: "manual" });
    expect(bare.status).toBe(301);
    expect(bare.headers.get("location")).toBe("/mobile/");
  });

  it("stays off unless SERVE_APP_FILES is true", () => {
    const app = express();
    serveAppFiles(app, {});
    expect(app.router.stack).toHaveLength(0);
  });
});
