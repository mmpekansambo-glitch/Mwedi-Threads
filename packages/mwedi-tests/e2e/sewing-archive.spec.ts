import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const photo = readFileSync(fileURLToPath(new URL("../fixtures/yarn-photo.png", import.meta.url)));
const shots = process.env.ARCHIVE_SCREENSHOTS;
const floral = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#2F4F8F"/><circle cx="40" cy="40" r="14" fill="#E58FB0"/><circle cx="85" cy="55" r="12" fill="#F1E6CF"/></svg>`;

function fabric(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, fabricType: "cotton", construction: "woven", print: "floral", generalColor: "blue", unit: "meters",
    amount: 3, amountLeft: 2, width: 145, preWashed: null, notes: null, photoCount: 1, archivedAt: null as string | null,
    createdAt: "2026-10-20T12:00:00.000Z", updatedAt: "2026-10-20T12:00:00.000Z",
    ...overrides,
  };
}

function tool(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, section: "notions", category: "button", name: "Shell buttons", quantity: 4, size: "15 mm", color: "Ivory", brand: "Dill", notes: null,
    hasPhoto: false, archivedAt: null as string | null, createdAt: "2026-10-20T12:00:00.000Z", updatedAt: "2026-10-20T12:00:00.000Z",
    ...overrides,
  };
}

const lawnId = "eeeeeeee-0000-4000-8000-000000000001";
const oldDenimId = "eeeeeeee-0000-4000-8000-000000000002";
const buttonsId = "ffffffff-0000-4000-8000-000000000001";

async function mockApi(page: Page) {
  const state = {
    fabrics: [
      fabric(lawnId),
      fabric(oldDenimId, { fabricType: "denim", print: "solid", amount: 2, amountLeft: 0, archivedAt: "2026-10-01T12:00:00.000Z" }),
    ],
    tools: [
      tool(buttonsId),
      tool("ffffffff-0000-4000-8000-000000000002", { name: "Horn buttons", brand: "dill" }),
      tool("ffffffff-0000-4000-8000-000000000003", { section: "kit", category: "scissors", name: "Shears", quantity: 1, color: null, brand: "Fiskars" }),
    ],
    project: {
      id: "aaaaaaaa-1111-4000-8000-000000000001", title: "Sundress", status: "in_progress", stage: "sew", patternName: null, patternDesigner: null,
      sizeMade: null, fitChanges: null, needleType: null, needleSize: null, threadColor: null, notes: null, completedAt: null as string | null,
      fabrics: [] as unknown[], tools: [], machineSettings: [], entries: [], createdAt: "2026-10-21T12:00:00.000Z", updatedAt: "2026-10-22T12:00:00.000Z",
    },
    creates: [] as Record<string, unknown>[],
    fabricPatches: [] as unknown[],
    renames: [] as unknown[],
  };
  state.project.fabrics = [{ stashFabricId: lawnId, amountUsed: 2, fabric: state.fabrics[0] }];
  await page.route("**/storage.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const archived = url.searchParams.get("archived") === "true";
    if (pathname === "/api/me/crafts") return route.fulfill({ json: { yarn: false, sewing: true, needsChoice: false } });
    if (pathname === "/api/fabric-stash/photo-upload") return route.fulfill({ json: { uploadURL: "https://storage.test/upload", photoPath: "/objects/fabric/user/eeeeeeee-0000-4000-8000-0000000000f1" } });
    if (/\/photos\/\d$/.test(pathname)) return route.fulfill({ contentType: "image/svg+xml", body: floral });
    if (pathname === "/api/fabric-stash" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.creates.push(body);
      const old = state.fabrics.find((item) => item.id === oldDenimId)!;
      if (body.restoreId === oldDenimId) {
        Object.assign(old, body, { archivedAt: null, photoCount: 1 });
        return route.fulfill({ status: 200, json: { ...old, restored: true } });
      }
      if (body.fabricType === "denim" && !body.addAsNew) return route.fulfill({ status: 409, json: { match: old, similarPhoto: true } });
      return route.fulfill({ status: 201, json: fabric("eeeeeeee-0000-4000-8000-000000000009", body) });
    }
    if (pathname === "/api/fabric-stash") return route.fulfill({ json: state.fabrics.filter((item) => Boolean(item.archivedAt) === archived) });
    const fabricMatch = pathname.match(/^\/api\/fabric-stash\/([^/]+)$/);
    const piece = fabricMatch && state.fabrics.find((item) => item.id === fabricMatch[1]);
    if (piece && request.method() === "PATCH") {
      const { archived: move, ...changes } = request.postDataJSON() as Record<string, unknown>;
      state.fabricPatches.push(request.postDataJSON());
      Object.assign(piece, changes);
      if (move !== undefined) piece.archivedAt = move ? "2026-10-29T12:00:00.000Z" : null;
      return route.fulfill({ json: piece });
    }
    if (piece) return route.fulfill({ json: piece });
    if (pathname === `/api/sewing-projects/${state.project.id}`) {
      if (request.method() === "PATCH") Object.assign(state.project, request.postDataJSON(), { stage: "finish", completedAt: "2026-10-29" });
      return route.fulfill({ json: state.project });
    }
    if (pathname === "/api/sewing-tools/rename-brand") {
      const body = request.postDataJSON() as { from: string; to: string };
      state.renames.push(body);
      for (const item of state.tools) if (item.brand?.toLowerCase() === body.from.toLowerCase()) item.brand = body.to;
      return route.fulfill({ json: { renamed: 1 } });
    }
    if (pathname === "/api/sewing-tools") return route.fulfill({ json: state.tools.filter((item) => Boolean(item.archivedAt) === archived) });
    const toolMatch = pathname.match(/^\/api\/sewing-tools\/([^/]+)$/);
    const item = toolMatch && state.tools.find((entry) => entry.id === toolMatch[1]);
    if (item && request.method() === "PATCH") {
      const { archived: move, ...changes } = request.postDataJSON() as Record<string, unknown>;
      Object.assign(item, changes);
      if (move !== undefined) item.archivedAt = move ? "2026-10-29T12:00:00.000Z" : null;
      return route.fulfill({ json: item });
    }
    if (item) return route.fulfill({ json: item });
    return route.fulfill({ json: [] });
  });
  return state;
}

test("amount left follows amount bought, and used-up fabric is offered the Archive", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/sewing/fabric");
  await expect(page.getByTestId(`card-fabric-${lawnId}`)).toContainText("2 of 3 m left");
  await page.getByTestId(`card-fabric-${lawnId}`).click();
  await expect(page.getByTestId("input-fabric-brand")).toHaveCount(0);
  const bought = page.getByTestId("input-fabric-amount");
  const left = page.getByTestId("input-fabric-amount-left");
  await bought.fill("4");
  await expect(left).toHaveValue("3");
  await expect(page.getByTestId("fabric-left-nudge")).toHaveText("Amount left is now 3 m (was 2). Look right? Looks right");
  if (shots) await page.getByTestId("fabric-left-nudge").locator("..").screenshot({ path: `${shots}/fabric-left-nudge-web.png` });
  // Some was used, so buying less only drops what's left when it would be more than bought.
  await bought.fill("2.5");
  await expect(left).toHaveValue("2");
  await bought.fill("1.5");
  await expect(left).toHaveValue("1.5");

  await left.fill("0");
  await page.getByTestId("button-save-fabric").click();
  await expect(page.getByTestId(`archive-nudge-${lawnId}`)).toContainText("All used up. Move Cotton, floral to your Archive?");
  await page.getByTestId("button-move-to-archive").click();
  await expect(page).toHaveURL(/\/sewing\/fabric$/);
  await expect(page.getByTestId("signpost")).toContainText("Find it under Archive on the Fabric stash page.");
  await expect(page.getByTestId(`card-fabric-${lawnId}`)).toHaveCount(0);
  await page.getByTestId("button-archive-filter").click();
  await expect(page.getByTestId(`card-fabric-${lawnId}`)).toBeVisible();
  expect(state.fabricPatches.at(-1)).toEqual({ archived: true });
});

test("asks \"Same fabric?\" before adding one that matches the Archive, and brings it back", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/sewing/fabric/new");
  await page.getByTestId("input-fabric-photo-main").setInputFiles({ name: "print.png", mimeType: "image/png", buffer: photo });
  await page.getByTestId("select-fabric-type").click();
  await page.getByTestId("select-fabric-type-wheel").getByRole("option", { name: "Denim" }).click();
  await page.getByTestId("select-fabric-type-done").click();
  await page.getByTestId("input-fabric-amount").fill("3");
  await page.getByTestId("button-save-fabric").click();

  const check = page.getByTestId("same-fabric-check");
  await expect(check).toContainText("Same fabric? This looks like the denim in your Archive.");
  await expect(check.getByRole("img")).toHaveCount(2);
  if (shots) await page.screenshot({ path: `${shots}/same-fabric-web.png` });
  await page.getByTestId("button-same-fabric").click();
  await expect(page).toHaveURL(/\/sewing\/fabric$/);
  expect(state.creates.at(-1)).toMatchObject({ fabricType: "denim", amount: 3, restoreId: oldDenimId, photoPaths: ["/objects/fabric/user/eeeeeeee-0000-4000-8000-0000000000f1"] });
  await expect(page.getByTestId("signpost")).toContainText("Welcome back: your denim was in your Archive");
  await expect(page.getByTestId(`card-fabric-${oldDenimId}`)).toBeVisible();
});

test("a different piece is added as new", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/sewing/fabric/new");
  await page.getByTestId("input-fabric-photo-main").setInputFiles({ name: "print.png", mimeType: "image/png", buffer: photo });
  await page.getByTestId("select-fabric-type").click();
  await page.getByTestId("select-fabric-type-wheel").getByRole("option", { name: "Denim" }).click();
  await page.getByTestId("select-fabric-type-done").click();
  await page.getByTestId("button-save-fabric").click();
  await page.getByTestId("button-different-fabric").click();
  await expect(page).toHaveURL(/\/sewing\/fabric$/);
  expect(state.creates.at(-1)).toMatchObject({ fabricType: "denim", addAsNew: true });
});

test("finishing a project that used the last of a fabric offers the Archive", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto(`/sewing/projects/${state.project.id}`);
  await page.getByTestId("button-finish-sewing-project").click();
  await expect(page.getByTestId("prompt-fabric-left")).toContainText("Cotton, floral: 2 m left → 0 m");
  await page.getByTestId("button-update-stash").click();
  expect(state.fabricPatches[0]).toEqual({ amountLeft: 0 });
  await expect(page.getByTestId(`archive-nudge-${lawnId}`)).toBeVisible();
  await page.getByTestId("button-keep-in-stash").click();
  await expect(page.getByTestId(`archive-nudge-${lawnId}`)).toHaveCount(0);
});

test("a used-up notion is offered the Archive, and a renamed brand can be renamed on other tools", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto(`/sewing/tools/${buttonsId}`);
  await page.getByTestId("input-tool-quantity").fill("0");
  await page.getByTestId("input-tool-brand").fill("Dill Buttons");
  await page.getByTestId("button-save-tool").click();

  await expect(page.getByTestId("rename-offer")).toContainText("You have 1 other tool with the old brand. Rename Dill to Dill Buttons on it too?");
  await expect(page.getByTestId(`archive-nudge-${buttonsId}`)).toContainText("All used up. Move Shell buttons to your Archive?");
  if (shots) await page.screenshot({ path: `${shots}/tool-archive-web.png` });
  await page.getByTestId("button-rename-others").click();
  expect(state.renames).toEqual([{ from: "Dill", to: "Dill Buttons" }]);
  await page.getByTestId("button-move-to-archive").click();
  await expect(page).toHaveURL(/\/sewing\/tools/);
  await expect(page.getByTestId("signpost")).toContainText("Find it under Archive on the Tools page.");
  await expect(page.getByTestId(`card-tool-${buttonsId}`)).toHaveCount(0);
  await page.getByTestId("button-archive-filter").click();
  await expect(page.getByTestId(`card-tool-${buttonsId}`)).toBeVisible();
  await expect(page.getByTestId("section-tools-kit")).toHaveCount(0);
});

test("kit is never offered the Archive", async ({ page }) => {
  await mockApi(page);
  await page.goto("/sewing/tools/ffffffff-0000-4000-8000-000000000003");
  await page.getByTestId("input-tool-quantity").fill("0");
  await page.getByTestId("button-save-tool").click();
  await expect(page).toHaveURL(/\/sewing\/tools\?section=kit/);
  await expect(page.getByTestId("archive-nudge-ffffffff-0000-4000-8000-000000000003")).toHaveCount(0);
});
