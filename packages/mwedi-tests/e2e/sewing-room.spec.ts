import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const photo = readFileSync(fileURLToPath(new URL("../fixtures/yarn-photo.png", import.meta.url)));
const shots = process.env.SEWING_SCREENSHOTS;

// Simple drawn prints stand in for fabric photos.
const prints: Record<string, string> = {
  floral: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#2F4F8F"/>${[[20, 20], [60, 15], [100, 25], [35, 55], [80, 60], [15, 80], [110, 78]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="4" fill="#F1E6CF"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="3" ry="6" cy="-7" fill="#E58FB0" transform="rotate(${a})"/>`).join("")}</g>`).join("")}</svg>`,
  stripe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#F1E6CF"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="0" y="${i * 12}" width="120" height="5" fill="#1F2F16"/>`).join("")}</svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#C0392B"/>${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 24}" width="12" height="90" fill="#222" opacity=".45"/><rect y="${i * 18}" width="120" height="9" fill="#222" opacity=".45"/>`).join("")}</svg>`,
};

function fabric(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, fabricType: "cotton", construction: "woven", print: "floral", generalColor: "blue", unit: "meters",
    amount: 2.5, amountLeft: null, width: 145, preWashed: null, notes: "Lawn for a summer dress", photoCount: 2, archivedAt: null as string | null,
    createdAt: "2026-10-20T12:00:00.000Z", updatedAt: "2026-10-20T12:00:00.000Z",
    ...overrides,
  };
}

const stash = [
  fabric("bbbbbbbb-0000-4000-8000-000000000001"),
  fabric("bbbbbbbb-0000-4000-8000-000000000002", { fabricType: "jersey", construction: "knit", print: "stripe", generalColor: "black", unit: "yards", amount: 1.5, width: 60, photoCount: 1 }),
  fabric("bbbbbbbb-0000-4000-8000-000000000003", { fabricType: "wool", print: "check", generalColor: "red", amount: 3, width: 150, photoCount: 1 }),
];

type Sent = { crafts: unknown[]; create?: unknown; uploads: number; projectSaves: unknown[]; fabricUpdates: unknown[] };
const newSent = (): Sent => ({ crafts: [], uploads: 0, projectSaves: [], fabricUpdates: [] });

type ProjectFabric = { stashFabricId: string; amountUsed: number | null };

function sewingProject(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, title: "Linen shirt", status: "in_progress", stage: "cut", patternName: "Camp shirt", patternDesigner: "Maker Example",
    sizeMade: "M", fitChanges: "Shortened the sleeves 3 cm", needleType: null, needleSize: null, threadColor: null, notes: null, completedAt: null,
    fabrics: [{ stashFabricId: stash[0].id, amountUsed: 1.75, fabric: stash[0] }], tools: [], machineSettings: [], entries: [],
    createdAt: "2026-10-21T12:00:00.000Z", updatedAt: "2026-10-22T12:00:00.000Z",
    ...overrides,
  };
}

function sewingTool(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, section: "notions", category: "zip", name: "Invisible zip", quantity: 4, size: "22 cm", color: "Navy", brand: null, notes: null, hasPhoto: false,
    createdAt: "2026-10-20T12:00:00.000Z", updatedAt: "2026-10-20T12:00:00.000Z",
    ...overrides,
  };
}

const tools = [
  sewingTool("dddddddd-0000-4000-8000-000000000001"),
  sewingTool("dddddddd-0000-4000-8000-000000000002", { section: "kit", category: "presser_foot", name: "Walking foot", quantity: null, size: null, color: null }),
];

const itemMatchPatch = (pathname: string) => pathname.match(/^\/api\/fabric-stash\/([^/]+)$/)?.[1];

async function mockApi(page: Page, crafts: { yarn: boolean; sewing: boolean; needsChoice: boolean }, sent: Sent) {
  let current = crafts;
  const projects = [
    sewingProject("cccccccc-0000-4000-8000-000000000001"),
    sewingProject("cccccccc-0000-4000-8000-000000000002", {
      title: "Striped tee", status: "planning", stage: "prep", patternName: null, sizeMade: "S", fitChanges: null,
      fabrics: [{ stashFabricId: stash[1].id, amountUsed: null, fabric: stash[1] }],
    }),
  ];
  // Saved projects get their fabric back from the stash, like the API.
  const withFabric = (body: Record<string, unknown>) => ({
    ...body,
    ...(body.fabrics ? { fabrics: (body.fabrics as ProjectFabric[]).map((item) => ({ ...item, fabric: stash.find((entry) => entry.id === item.stashFabricId) })) } : {}),
    ...(body.toolIds ? { tools: (body.toolIds as string[]).map((id) => tools.find((entry) => entry.id === id)) } : {}),
  });
  await page.route("**/storage.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    if (pathname === "/api/me/crafts") {
      if (request.method() === "PUT") {
        const body = request.postDataJSON() as { yarn: boolean; sewing: boolean };
        sent.crafts.push(body);
        current = { ...body, needsChoice: false };
      }
      return route.fulfill({ json: current });
    }
    if (pathname === "/api/fabric-stash/photo-upload") {
      sent.uploads += 1;
      return route.fulfill({ json: { uploadURL: "https://storage.test/upload", photoPath: `/objects/fabric/user/bbbbbbbb-0000-4000-8000-0000000000f${sent.uploads}` } });
    }
    if (pathname === "/api/fabric-stash" && request.method() === "POST") {
      sent.create = request.postDataJSON();
      return route.fulfill({ status: 201, json: fabric("bbbbbbbb-0000-4000-8000-000000000009", sent.create as object) });
    }
    const photoMatch = pathname.match(/^\/api\/fabric-stash\/([^/]+)\/photos\/\d$/);
    if (photoMatch) {
      const item = stash.find((entry) => entry.id === photoMatch[1]);
      return route.fulfill({ contentType: "image/svg+xml", body: prints[String(item?.print ?? "floral")] });
    }
    if (pathname === "/api/fabric-stash") {
      const print = url.searchParams.get("print");
      const type = url.searchParams.get("fabricType");
      const archived = url.searchParams.get("archived") === "true";
      return route.fulfill({ json: stash.filter((item) => (!print || item.print === print) && (!type || item.fabricType === type) && Boolean(item.archivedAt) === archived) });
    }
    const itemMatch = pathname.match(/^\/api\/fabric-stash\/([^/]+)$/);
    if (itemMatch && request.method() === "GET") return route.fulfill({ json: stash.find((entry) => entry.id === itemMatch[1]) });
    if (pathname === "/api/sewing-overview") {
      return route.fulfill({ json: {
        inProgress: 1, finished: 0, fabricPieces: 3, fabricLength: 7.37, fabricUnit: "meters",
        stages: [{ stage: "prep", count: 0 }, { stage: "cut", count: 1 }, { stage: "sew", count: 0 }, { stage: "fit", count: 0 }, { stage: "finish", count: 0 }],
        fabricTypes: [{ fabricType: "cotton", count: 1 }, { fabricType: "jersey", count: 1 }, { fabricType: "wool", count: 1 }],
        recentProjects: projects,
      } });
    }
    if (pathname === "/api/sewing-projects" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      sent.projectSaves.push(body);
      const created = sewingProject("cccccccc-0000-4000-8000-000000000009", { stage: "prep", ...withFabric(body) });
      projects.unshift(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (pathname === "/api/sewing-projects") {
      const status = url.searchParams.get("status");
      return route.fulfill({ json: projects.filter((item) => !status || item.status === status) });
    }
    const projectMatch = pathname.match(/^\/api\/sewing-projects\/([^/]+)$/);
    if (projectMatch) {
      const index = projects.findIndex((entry) => entry.id === projectMatch[1]);
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as Record<string, unknown>;
        sent.projectSaves.push(body);
        const finishing = body.status === "completed";
        projects[index] = { ...projects[index], ...withFabric(body), ...(finishing ? { stage: "finish", completedAt: "2026-10-27" } : {}) };
      }
      return route.fulfill({ json: projects[index] });
    }
    if (itemMatchPatch(pathname) && request.method() === "PATCH") {
      sent.fabricUpdates.push({ id: itemMatchPatch(pathname), ...(request.postDataJSON() as object) });
      return route.fulfill({ json: stash.find((entry) => entry.id === itemMatchPatch(pathname)) });
    }
    if (pathname === "/api/sewing-tools") return route.fulfill({ json: tools });
    if (pathname === "/api/dashboard") {
      return route.fulfill({ json: { totalProjects: 0, activeProjects: 0, completedProjects: 0, recentProjects: [], recentProgress: [], mostUsedYarnBrands: [], mostUsedYarnBrandProjects: 0, averageDaysToFinish: null, charts: { projectsByStatus: [], completedPerMonth: [], completedWithoutDate: 0, progressPerWeek: [] } } });
    }
    return route.fulfill({ json: [] });
  });
}

test("shows the Sewing room with its own look, switcher and fabric swatches", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await mockApi(page, { yarn: true, sewing: true, needsChoice: false }, newSent());
  await page.goto("/sewing/fabric");
  await expect(page.getByTestId("link-fabric")).toHaveClass(/selected/);
  await expect(page.locator(".portal-shell")).toHaveClass(/home-sewing/);
  await expect(page.getByTestId("link-home-sewing")).toHaveClass(/selected/);
  await expect(page.getByText("3 fabrics")).toBeVisible();
  const card = page.getByTestId("card-fabric-bbbbbbbb-0000-4000-8000-000000000001");
  await expect(card).toContainText("Cotton, floral");
  await expect(card).toContainText("Woven");
  await expect(card).toContainText("2.5 m · 145 cm wide");
  await expect(page.getByTestId("card-fabric-bbbbbbbb-0000-4000-8000-000000000002")).toContainText("1.5 yd · 60 in wide");
  if (shots) await page.screenshot({ path: `${shots}/fabric-stash-web.png` });

  await page.getByTestId("select-fabric-print-filter").selectOption("stripe");
  await expect(page.getByText("1 fabric", { exact: true })).toBeVisible();

  await page.getByTestId("link-home-yarn").click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".portal-shell")).toHaveClass(/home-yarn/);
  await expect(page.getByTestId("link-fabric")).toHaveCount(0);
});

test("adds a fabric with a print close-up and an extra photo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1320 });
  const sent = newSent();
  await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, sent);
  await page.goto("/sewing/fabric/new");
  await expect(page.getByTestId("link-home-yarn")).toHaveCount(0);
  await page.getByTestId("button-save-fabric").click();
  await expect(page.getByText("Add a photo of the print.")).toBeVisible();
  await expect(page.getByText("Choose the fabric type.")).toBeVisible();

  await page.getByTestId("input-fabric-photo-main").setInputFiles({ name: "print.png", mimeType: "image/png", buffer: photo });
  await page.getByTestId("input-fabric-photo-more").setInputFiles({ name: "drape.png", mimeType: "image/png", buffer: photo });
  await page.getByTestId("select-fabric-type").click();
  const typeWheel = page.getByTestId("select-fabric-type-wheel");
  await expect(typeWheel.getByRole("option")).toHaveCount(22);
  await expect(typeWheel.getByRole("option").first()).toHaveText("Blend");
  await expect(typeWheel.getByRole("option").last()).toHaveText("Other");
  await typeWheel.getByRole("option", { name: "Linen" }).click();
  await page.getByTestId("select-fabric-type-done").click();
  await expect(page.getByTestId("select-fabric-type")).toHaveText("Linen");
  await page.getByTestId("button-construction-woven").click();
  await page.getByTestId("select-fabric-print").click();
  await expect(page.getByTestId("select-fabric-print-wheel").getByRole("option")).toHaveText(["Abstract", "Animal", "Ankara (wax print)", "Batik", "Botanical", "Camo", "Check or plaid", "Chevron", "Damask", "Dots", "Floral", "Geometric", "Houndstooth", "Ikat", "Novelty", "Ombré", "Paisley", "Solid", "Stripe", "Tie-dye", "Toile", "Other"]);
  await page.getByTestId("select-fabric-print-wheel").getByRole("option", { name: "Check or plaid" }).click();
  if (shots) await page.screenshot({ path: `${shots}/fabric-print-wheel-web.png` });
  await page.getByTestId("select-fabric-print-done").click();
  await expect(page.getByTestId("select-fabric-print")).toHaveText("Check or plaid");
  await page.getByTestId("button-unit-yards").click();
  await expect(page.locator(".input-with-unit i").first()).toHaveText("yd");
  await page.getByTestId("input-fabric-amount").fill("2.75");
  await page.getByTestId("input-fabric-width").fill("54");
  await page.getByTestId("button-general-color-green").click();
  await page.getByTestId("button-prewashed-yes").click();
  await expect(page.getByTestId("button-prewashed-yes")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("input-fabric-notes").fill("For a shirt");
  if (shots) await page.screenshot({ path: `${shots}/fabric-form-web.png` });
  await page.getByTestId("button-save-fabric").click();

  await expect(page).toHaveURL(/\/sewing\/fabric$/);
  expect(sent.uploads).toBe(2);
  expect(sent.create).toMatchObject({
    fabricType: "linen", construction: "woven", print: "check", generalColor: "green", unit: "yards",
    amount: 2.75, amountLeft: null, width: 54, preWashed: true, notes: "For a shirt",
    photoPaths: ["/objects/fabric/user/bbbbbbbb-0000-4000-8000-0000000000f1", "/objects/fabric/user/bbbbbbbb-0000-4000-8000-0000000000f2"],
  });
});

test("turns sewing on from Settings in the profile menu, keeping one craft on", async ({ page }) => {
  const sent = newSent();
  await mockApi(page, { yarn: true, sewing: false, needsChoice: false }, sent);
  await page.goto("/dashboard");
  await expect(page.getByTestId("link-home-sewing")).toHaveCount(0);
  await page.getByTestId("button-profile-menu").click();
  await expect(page.getByText("My crafts")).toBeVisible();
  await expect(page.getByTestId("switch-craft-yarn")).toBeDisabled();
  if (shots) await page.screenshot({ path: `${shots}/settings-menu-web.png`, clip: { x: 0, y: 400, width: 260, height: 320 } });
  await page.getByTestId("switch-craft-sewing").click();
  await expect(page.getByTestId("switch-craft-sewing")).toHaveAttribute("aria-checked", "true");
  expect(sent.crafts).toEqual([{ yarn: true, sewing: true }]);
  await expect(page.getByTestId("link-home-sewing")).toBeVisible();
  await expect(page.getByTestId("switch-craft-yarn")).toBeEnabled();
});

test("sends a yarn page to the Sewing room when yarn is off", async ({ page }) => {
  await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, newSent());
  await page.goto("/stash");
  await expect(page).toHaveURL(/\/sewing$/);
});

test("asks a new maker what they make", async ({ page }) => {
  const sent = newSent();
  await mockApi(page, { yarn: true, sewing: false, needsChoice: true }, sent);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "What do you make?" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/craft-choice-web.png` });
  await page.getByTestId("button-craft-choice-sewing").click();
  await expect(page).toHaveURL(/\/sewing$/);
  expect(sent.crafts).toEqual([{ yarn: false, sewing: true }]);
});

test("shows the Sewing room Overview with stages and recent projects", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await mockApi(page, { yarn: true, sewing: true, needsChoice: false }, newSent());
  await page.goto("/sewing");
  await expect(page.getByTestId("link-sewing-overview")).toHaveClass(/selected/);
  await expect(page.getByTestId("link-sewing-stat-in-progress")).toContainText("1");
  await expect(page.getByTestId("text-fabric-length")).toHaveText("7.37 m in your stash");
  await expect(page.getByTestId("stage-count-cut")).toContainText("1");
  await expect(page.getByTestId("card-sewing-project-cccccccc-0000-4000-8000-000000000001")).toContainText("Camp shirt · Size M");
  if (shots) await page.screenshot({ path: `${shots}/sewing-overview-web.png`, fullPage: true });

  await expect(page.getByTestId("link-fabric-type-wool")).toContainText("Wool");
  await page.getByTestId("link-sewing-stat-in-progress").click();
  await expect(page).toHaveURL(/\/sewing\/projects\?status=in_progress$/);
  await expect(page.getByText("1 project", { exact: true })).toBeVisible();
});

test("opens the fabric stash filtered to a type from the Overview chart", async ({ page }) => {
  await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, newSent());
  await page.goto("/sewing");
  await page.getByTestId("link-fabric-type-jersey").click();
  await expect(page).toHaveURL(/\/sewing\/fabric\?type=jersey$/);
  await expect(page.getByTestId("select-fabric-type-filter")).toHaveValue("jersey");
  await expect(page.getByText("1 fabric", { exact: true })).toBeVisible();
});

test("adds tools, a needle and a thread color to a sewing project", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1500 });
  const sent = newSent();
  await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, sent);
  await page.goto("/sewing/projects/cccccccc-0000-4000-8000-000000000001/edit");
  await expect(page.getByTestId("row-sewing-needle")).toContainText("Add");
  await expect(page.getByTestId("row-sewing-thread")).toContainText("Add");

  await page.getByTestId("button-add-sewing-tool").click();
  await page.getByTestId(`button-pick-tool-${tools[1].id}`).click();
  await page.getByTestId("button-add-sewing-tool").click();
  await page.getByTestId(`button-pick-tool-${tools[0].id}`).click();
  await expect(page.getByTestId(`sewing-tool-${tools[1].id}`)).toContainText("Walking foot");

  await page.getByTestId("row-sewing-needle").click();
  await page.getByTestId("row-sewing-needle-wheel-0").getByRole("option", { name: "Stretch" }).click();
  await page.getByTestId("row-sewing-needle-wheel-1").getByRole("option", { name: "75/11" }).click();
  if (shots) await page.screenshot({ path: `${shots}/needle-wheel-web.png`, fullPage: true });
  await page.getByTestId("row-sewing-needle-done").click();
  await expect(page.getByTestId("row-sewing-needle")).toContainText("Stretch 75/11");
  await page.getByTestId("row-sewing-thread").click();
  await page.getByTestId("row-sewing-thread-wheel-0").getByRole("option", { name: "Blue" }).click();
  await page.getByTestId("row-sewing-thread-done").click();
  await expect(page.getByTestId("row-sewing-thread")).toContainText("Blue");
  if (shots) await page.screenshot({ path: `${shots}/project-form-tools-web.png`, fullPage: true });
  await page.getByTestId("button-save-sewing-project").click();

  await expect(page).toHaveURL(/\/sewing\/projects\/cccccccc-0000-4000-8000-000000000001$/);
  expect(sent.projectSaves[0]).toMatchObject({
    needleType: "stretch", needleSize: "75/11", threadColor: "blue", toolIds: [tools[1].id, tools[0].id],
  });
  await expect(page.getByText("Stretch 75/11")).toBeVisible();
  await expect(page.getByTestId(`card-tool-${tools[0].id}`)).toContainText("Invisible zip");
  if (shots) await page.screenshot({ path: `${shots}/project-page-tools-web.png`, fullPage: true });
});

test("keeps named machine settings on a sewing project", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1500 });
  const sent = newSent();
  await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, sent);
  await page.goto("/sewing/projects/cccccccc-0000-4000-8000-000000000001");
  // Nothing shows on the project page until there are settings.
  await expect(page.getByText("Shortened the sleeves 3 cm")).toBeVisible();
  await expect(page.getByTestId("sewing-machine-settings")).toHaveCount(0);
  await page.goto("/sewing/projects/cccccccc-0000-4000-8000-000000000001/edit");
  if (shots) await page.screenshot({ path: `${shots}/form-machine-empty-web.png`, fullPage: true });

  await page.getByTestId("button-add-machine-settings").click();
  await page.getByTestId("input-machine-name-0").fill("Seams");
  await page.getByTestId("row-machine-stitch-0").click();
  await page.getByTestId("row-machine-stitch-0-wheel-0").getByRole("option", { name: "Straight" }).click();
  await page.getByTestId("row-machine-stitch-0-done").click();
  await page.getByTestId("row-machine-length-0").click();
  await page.getByTestId("row-machine-length-0-wheel-0").getByRole("option", { name: "2.5 mm" }).click();
  await page.getByTestId("row-machine-length-0-done").click();
  await page.getByTestId("row-machine-tension-0").click();
  await page.getByTestId("row-machine-tension-0-wheel-0").getByRole("option", { name: "4", exact: true }).click();
  await page.getByTestId("row-machine-tension-0-done").click();
  await page.getByTestId("row-machine-foot-0").click();
  await page.getByTestId("row-machine-foot-0-wheel-0").getByRole("option", { name: "All-purpose" }).click();
  await page.getByTestId("row-machine-foot-0-done").click();
  await expect(page.getByTestId("row-machine-width-0")).toContainText("Add");
  if (shots) await page.screenshot({ path: `${shots}/form-machine-open-web.png`, fullPage: true });
  await page.getByTestId("button-machine-done-0").click();
  await expect(page.getByTestId("machine-set-0")).toContainText("Straight · Length 2.5 mm · Tension 4 · All-purpose foot");

  // An empty set is dropped when it's closed.
  await page.getByTestId("button-add-machine-settings").click();
  await page.getByTestId("button-machine-done-1").click();
  await expect(page.getByTestId("machine-set-1")).toHaveCount(0);

  await page.getByTestId("button-add-machine-settings").click();
  await page.getByTestId("input-machine-name-1").fill("Topstitch");
  await page.getByTestId("row-machine-length-1").click();
  await page.getByTestId("row-machine-length-1-wheel-0").getByRole("option", { name: "3.5 mm" }).click();
  await page.getByTestId("row-machine-length-1-done").click();
  await page.getByTestId("input-machine-note-1").fill("Topstitch thread on top");
  await page.getByTestId("button-machine-done-1").click();
  if (shots) await page.screenshot({ path: `${shots}/form-machine-sets-web.png`, fullPage: true });
  await page.getByTestId("button-save-sewing-project").click();

  await expect(page).toHaveURL(/\/sewing\/projects\/cccccccc-0000-4000-8000-000000000001$/);
  expect(sent.projectSaves[0]).toMatchObject({
    machineSettings: [
      { name: "Seams", stitch: "straight", stitchLength: 2.5, stitchWidth: null, tension: 4, presserFoot: "all_purpose", notes: null },
      { name: "Topstitch", stitch: null, stitchLength: 3.5, stitchWidth: null, tension: null, presserFoot: null, notes: "Topstitch thread on top" },
    ],
  });
  const shown = page.getByTestId("sewing-machine-settings");
  await expect(shown).toContainText("Seams");
  await expect(shown).toContainText("Length 3.5 mm");
  await expect(shown).toContainText("Topstitch thread on top");
  if (shots) {
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shots}/project-page-machine-web.png`, fullPage: true });
  }
});

test("starts a sewing project with fabric from the stash", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1300 });
  const sent = newSent();
  await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, sent);
  await page.goto("/sewing/projects/new");
  await page.getByTestId("button-save-sewing-project").click();
  await expect(page.getByText("Give your project a name.")).toBeVisible();

  await page.getByTestId("input-sewing-title").fill("Wool skirt");
  await page.getByTestId("input-sewing-pattern").fill("A-line skirt");
  await page.getByTestId("input-sewing-size").fill("12");
  await page.getByTestId("input-sewing-fit").fill("Took in the waist 1 cm");
  await page.getByTestId("button-add-sewing-fabric").click();
  await page.getByTestId(`button-pick-fabric-${stash[2].id}`).click();
  await page.getByTestId("input-sewing-fabric-used-0").fill("1.2");
  if (shots) await page.screenshot({ path: `${shots}/sewing-project-form-web.png`, fullPage: true });
  await page.getByTestId("button-save-sewing-project").click();

  await expect(page).toHaveURL(/\/sewing\/projects\/cccccccc-0000-4000-8000-000000000009$/);
  expect(sent.projectSaves[0]).toMatchObject({
    title: "Wool skirt", status: "planning", patternName: "A-line skirt", sizeMade: "12", fitChanges: "Took in the waist 1 cm",
    fabrics: [{ stashFabricId: stash[2].id, amountUsed: 1.2 }],
  });
  await expect(page.getByTestId(`card-project-fabric-${stash[2].id}`)).toContainText("Uses 1.2 m");
});

test("moves a project through stages and offers to update the stash when it's finished", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const sent = newSent();
  await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, sent);
  await page.goto("/sewing/projects/cccccccc-0000-4000-8000-000000000001");
  await expect(page.getByTestId("button-stage-cut")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Shortened the sleeves 3 cm")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/sewing-project-web.png`, fullPage: true });

  await page.getByTestId("button-stage-sew").click();
  await expect(page.getByTestId("button-stage-sew")).toHaveAttribute("aria-pressed", "true");
  expect(sent.projectSaves[0]).toEqual({ stage: "sew" });

  await page.getByTestId("button-finish-sewing-project").click();
  await expect(page.getByTestId("prompt-fabric-left")).toContainText("Cotton, floral: 2.5 m left → 0.75 m");
  await page.getByTestId("button-update-stash").click();
  await expect(page.getByTestId("prompt-fabric-left")).toHaveCount(0);
  expect(sent.fabricUpdates).toEqual([{ id: stash[0].id, amountLeft: 0.75 }]);
  await expect(page.getByTestId("button-reopen-sewing-project")).toBeVisible();
});
