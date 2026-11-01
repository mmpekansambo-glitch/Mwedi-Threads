import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const photo = readFileSync(fileURLToPath(new URL("../fixtures/yarn-photo.png", import.meta.url)));
const shots = process.env.SEWING_SCREENSHOTS;

// A drawn pattern envelope stands in for a cover photo.
const envelope = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#F3EEE6"/><rect x="14" y="10" width="52" height="60" rx="3" fill="#C9B79C"/><path d="M40 20 l10 8 -4 30 h-12 l-4 -30z" fill="#7A6898"/><rect x="20" y="62" width="40" height="4" fill="#5A4A3A"/></svg>`;
const projectId = "cccccccc-0000-4000-8000-000000000001";

function pattern(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, name: "Wrap dress", designer: "Maker Example", patternType: "dress", format: "pdf", sizes: "0–20", notes: null,
    hasPhoto: false, timesMade: 0, createdAt: "2026-10-27T12:00:00.000Z", updatedAt: "2026-10-27T12:00:00.000Z",
    ...overrides,
  };
}

type Sent = { saves: unknown[]; projectSaves: unknown[]; uploads: number; deleted: string[] };

async function mockApi(page: Page, sent: Sent) {
  const patterns = [
    pattern("eeeeeeee-0000-4000-8000-000000000001", { name: "Camp shirt", patternType: "shirt", format: "paper", sizes: "XS–XL", hasPhoto: true, timesMade: 2 }),
    pattern("eeeeeeee-0000-4000-8000-000000000002", { name: "Tote bag", designer: null, patternType: "bag", format: "self_drafted", sizes: null }),
    pattern("eeeeeeee-0000-4000-8000-000000000003", { timesMade: 1 }),
  ];
  await page.route("**/storage.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    if (pathname === "/api/me/crafts") return route.fulfill({ json: { yarn: false, sewing: true, needsChoice: false } });
    if (pathname === "/api/sewing-patterns/photo-upload") {
      sent.uploads += 1;
      return route.fulfill({ json: { uploadURL: "https://storage.test/upload", photoPath: "/objects/sewing-patterns/user/eeeeeeee-0000-4000-8000-0000000000f1" } });
    }
    if (pathname === "/api/sewing-patterns" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      sent.saves.push(body);
      const { photoPath, ...rest } = body;
      const created = pattern("eeeeeeee-0000-4000-8000-000000000009", { ...rest, hasPhoto: Boolean(photoPath) });
      patterns.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (pathname === "/api/sewing-patterns") {
      const search = url.searchParams.get("search")?.toLowerCase();
      const shown = patterns.filter((item) => !search || [item.name, item.designer, item.sizes].some((value) => String(value ?? "").toLowerCase().includes(search)));
      return route.fulfill({ json: [...shown].sort((a, b) => String(a.name).localeCompare(String(b.name))) });
    }
    if (/^\/api\/sewing-patterns\/[^/]+\/photo$/.test(pathname)) return route.fulfill({ contentType: "image/svg+xml", body: envelope });
    const match = pathname.match(/^\/api\/sewing-patterns\/([^/]+)$/);
    if (match) {
      const index = patterns.findIndex((item) => item.id === match[1]);
      if (request.method() === "DELETE") {
        sent.deleted.push(match[1]!);
        patterns.splice(index, 1);
        return route.fulfill({ status: 204, body: "" });
      }
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as Record<string, unknown>;
        sent.saves.push(body);
        const { photoPath, ...rest } = body;
        patterns[index] = { ...patterns[index]!, ...rest, ...(photoPath !== undefined ? { hasPhoto: Boolean(photoPath) } : {}) };
      }
      return route.fulfill({ json: patterns[index] });
    }
    if (pathname === "/api/sewing-projects" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      sent.projectSaves.push(body);
      const chosen = patterns.find((item) => item.id === body.patternId);
      return route.fulfill({ status: 201, json: {
        id: projectId, title: body.title, status: "planning", stage: "prep", patternId: chosen?.id ?? null,
        patternName: chosen?.name ?? null, patternDesigner: chosen?.designer ?? null, sizeMade: null, fitChanges: null,
        needleType: null, needleSize: null, threadColor: null, notes: null, completedAt: null, fabrics: [], tools: [], machineSettings: [], entries: [],
        createdAt: "2026-11-01T12:00:00.000Z", updatedAt: "2026-11-01T12:00:00.000Z",
      } });
    }
    if (pathname === `/api/sewing-projects/${projectId}`) {
      const saved = sent.projectSaves[0] as Record<string, unknown> | undefined;
      const chosen = patterns.find((item) => item.id === saved?.patternId);
      return route.fulfill({ json: {
        id: projectId, title: saved?.title ?? "Linen shirt", status: "planning", stage: "prep", patternId: chosen?.id ?? null,
        patternName: chosen?.name ?? null, patternDesigner: chosen?.designer ?? null, sizeMade: null, fitChanges: null,
        needleType: null, needleSize: null, threadColor: null, notes: null, completedAt: null, fabrics: [], tools: [], machineSettings: [], entries: [],
        createdAt: "2026-11-01T12:00:00.000Z", updatedAt: "2026-11-01T12:00:00.000Z",
      } });
    }
    return route.fulfill({ json: [] });
  });
}

const newSent = (): Sent => ({ saves: [], projectSaves: [], uploads: 0, deleted: [] });

test("lists patterns in their own Patterns page", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page, newSent());
  await page.goto("/sewing/patterns");
  await expect(page.getByTestId("link-patterns")).toHaveClass(/selected/);
  await expect(page.getByTestId("link-fabric")).toBeVisible();
  const shirt = page.getByTestId("card-pattern-eeeeeeee-0000-4000-8000-000000000001");
  await expect(shirt).toContainText("Shirt · Paper · Maker Example · Sizes XS–XL");
  await expect(shirt).toContainText("Made 2 times");
  await expect(page.getByTestId("card-pattern-eeeeeeee-0000-4000-8000-000000000003")).toContainText("Made once");
  await expect(page.getByTestId("card-pattern-eeeeeeee-0000-4000-8000-000000000002")).not.toContainText("Made");
  if (shots) await page.screenshot({ path: `${shots}/patterns-web.png`, fullPage: true });

  await page.getByTestId("input-search-patterns").fill("tote");
  await expect(page.locator(".tool-row")).toHaveCount(1);
});

test("adds a pattern with wheels and an optional photo, then edits and removes it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const sent = newSent();
  await mockApi(page, sent);
  await page.goto("/sewing/patterns/new");
  await page.getByTestId("button-save-pattern").click();
  await expect(page.getByText("Give it a name.")).toBeVisible();

  await page.getByTestId("input-pattern-name").fill("Linen trousers");
  await page.getByTestId("input-pattern-designer").fill("Maker Example");
  await page.getByTestId("select-pattern-type").click();
  if (shots) await page.screenshot({ path: `${shots}/pattern-type-wheel-web.png` });
  await page.getByTestId("select-pattern-type-wheel").getByRole("option", { name: "Trousers", exact: true }).click();
  await page.getByTestId("select-pattern-type-done").click();
  await page.getByTestId("select-pattern-format").click();
  await page.getByTestId("select-pattern-format-wheel").getByRole("option", { name: "PDF", exact: true }).click();
  await page.getByTestId("select-pattern-format-done").click();
  await page.getByTestId("input-pattern-sizes").fill("6–24");
  await page.getByTestId("input-pattern-photo").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: photo });
  if (shots) await page.screenshot({ path: `${shots}/pattern-form-web.png`, fullPage: true });
  await page.getByTestId("button-save-pattern").click();

  await expect(page).toHaveURL(/\/sewing\/patterns$/);
  expect(sent.uploads).toBe(1);
  expect(sent.saves[0]).toEqual({
    name: "Linen trousers", designer: "Maker Example", patternType: "trousers", format: "pdf", sizes: "6–24", notes: null,
    photoPath: "/objects/sewing-patterns/user/eeeeeeee-0000-4000-8000-0000000000f1",
  });

  await page.getByTestId("card-pattern-eeeeeeee-0000-4000-8000-000000000001").click();
  await expect(page.locator(".page-heading")).toContainText("Made 2 times");
  await page.getByTestId("input-pattern-notes").fill("Lengthen 3 cm");
  await page.getByTestId("button-save-pattern").click();
  await expect(page).toHaveURL(/\/sewing\/patterns$/);
  expect(sent.saves[1]).toMatchObject({ name: "Camp shirt", notes: "Lengthen 3 cm" });
  expect(sent.saves[1]).not.toHaveProperty("photoPath");

  await page.getByTestId("card-pattern-eeeeeeee-0000-4000-8000-000000000002").click();
  await page.getByTestId("button-delete-pattern").click();
  await expect(page.getByText("Projects that used it will show no pattern.")).toBeVisible();
  await page.getByTestId("button-confirm-delete-pattern").click();
  await expect(page).toHaveURL(/\/sewing\/patterns$/);
  expect(sent.deleted).toEqual(["eeeeeeee-0000-4000-8000-000000000002"]);
});

test("picks a project's pattern from the pattern stash", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const sent = newSent();
  await mockApi(page, sent);
  await page.goto("/sewing/projects/new");
  await page.getByTestId("input-sewing-title").fill("Linen shirt");
  if (shots) await page.screenshot({ path: `${shots}/project-pattern-row-web.png` });
  await page.getByTestId("row-sewing-pattern").click();
  if (shots) await page.screenshot({ path: `${shots}/project-pattern-picker-web.png`, fullPage: true });
  await page.getByTestId("button-pick-pattern-eeeeeeee-0000-4000-8000-000000000001").click();
  await expect(page.getByTestId("sewing-pattern-chosen")).toContainText("Camp shirt");
  if (shots) await page.screenshot({ path: `${shots}/project-pattern-chosen-web.png`, fullPage: true });
  await page.getByTestId("button-save-sewing-project").click();

  await expect(page).toHaveURL(new RegExp(`/sewing/projects/${projectId}$`));
  expect(sent.projectSaves[0]).toMatchObject({ title: "Linen shirt", patternId: "eeeeeeee-0000-4000-8000-000000000001" });
  expect(sent.projectSaves[0]).not.toHaveProperty("patternName");
  await expect(page.getByTestId("link-sewing-pattern")).toHaveAttribute("href", /\/sewing\/patterns\/eeeeeeee-0000-4000-8000-000000000001$/);
});
