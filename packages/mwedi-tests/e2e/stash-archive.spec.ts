import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const photo = readFileSync(fileURLToPath(new URL("../fixtures/yarn-photo.png", import.meta.url)));

function yarn(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, brand: "Lion Brand", subBrand: "Wool-Ease", color: "Fisherman", generalColor: "cream", weight: "worsted",
    blend: [{ fiber: "Acrylic", percent: 80 }, { fiber: "Wool", percent: 20 }], brandLink: null,
    photoPath: `/objects/stash/user/${id}`, skeinsPurchased: 5, skeinsLeft: 3, archivedAt: null,
    createdAt: "2026-10-28T12:00:00.000Z", updatedAt: "2026-10-28T12:00:00.000Z",
    ...overrides,
  };
}

const fishermanId = "cccccccc-0000-4000-8000-000000000001";
const seaGlassId = "cccccccc-0000-4000-8000-000000000002";

async function mockApi(page: Page) {
  const state = {
    stash: [
      yarn(fishermanId),
      yarn(seaGlassId, { color: "Sea Glass", generalColor: "blue", skeinsPurchased: 2, skeinsLeft: 0, archivedAt: "2026-10-20T12:00:00.000Z" }),
    ] as Array<ReturnType<typeof yarn>>,
    patches: [] as unknown[],
    created: undefined as unknown,
  };
  await page.route("**/storage.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    if (pathname === "/api/yarn-catalog") {
      return route.fulfill({ json: { brands: [], subBrands: [], colors: [], fibers: ["Acrylic", "Wool"], suggestions: { brand: null, subBrand: null, color: null } } });
    }
    if (pathname === "/api/yarn-stash/photo-upload") {
      return route.fulfill({ json: { uploadURL: "https://storage.test/upload", photoPath: "/objects/stash/user/cccccccc-0000-4000-8000-0000000000ff" } });
    }
    if (pathname.endsWith("/photo")) return route.fulfill({ status: 404, body: "" });
    if (pathname === "/api/yarn-stash" && request.method() === "POST") {
      const body = request.postDataJSON();
      state.created = body;
      const match = state.stash.find((item) => item.archivedAt && item.color.toLowerCase() === String(body.color).toLowerCase());
      if (match) {
        Object.assign(match, body, { archivedAt: null, skeinsLeft: body.skeinsLeft ?? body.skeinsPurchased });
        return route.fulfill({ status: 200, json: { ...match, restored: true } });
      }
      return route.fulfill({ status: 201, json: yarn("cccccccc-0000-4000-8000-000000000009", body) });
    }
    if (pathname === "/api/yarn-stash") {
      const archived = url.searchParams.get("archived") === "true";
      return route.fulfill({ json: state.stash.filter((item) => Boolean(item.archivedAt) === archived) });
    }
    const itemMatch = pathname.match(/^\/api\/yarn-stash\/([^/]+)$/);
    const item = itemMatch && state.stash.find((entry) => entry.id === itemMatch[1]);
    if (item && request.method() === "PATCH") {
      const changes = request.postDataJSON();
      state.patches.push(changes);
      const { archived, ...rest } = changes;
      Object.assign(item, rest);
      if (archived !== undefined) item.archivedAt = archived ? "2026-10-29T12:00:00.000Z" : null;
      return route.fulfill({ json: item });
    }
    if (item) return route.fulfill({ json: item });
    return route.fulfill({ json: [] });
  });
  return state;
}

test("skeins left follows skeins purchased with a gentle note", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/stash/${fishermanId}`);
  const purchased = page.getByTestId("input-skeins-purchased");
  const left = page.getByTestId("input-skeins-left");

  await purchased.fill("7");
  await expect(left).toHaveValue("5");
  await expect(page.getByTestId("skeins-left-nudge")).toHaveText("Skeins left is now 5 (was 3). Look right? Looks right");
  if (process.env.ARCHIVE_SCREENSHOTS) await page.getByTestId("skeins-left-nudge").locator("..").screenshot({ path: `${process.env.ARCHIVE_SCREENSHOTS}/skeins-nudge-web.png` });

  // Some were used, so buying fewer leaves what's left alone...
  await purchased.fill("4");
  await expect(left).toHaveValue("3");
  await expect(page.getByTestId("skeins-left-nudge")).toHaveCount(0);
  // ...unless what's left would be more than was bought.
  await purchased.fill("2");
  await expect(left).toHaveValue("2");
  await page.getByTestId("button-skeins-left-ok").click();
  await expect(page.getByTestId("skeins-left-nudge")).toHaveCount(0);

  // The maker's own number wins.
  await left.fill("1");
  await purchased.fill("9");
  await expect(left).toHaveValue("1");
});

test("offers the Archive when a yarn is used up, signposts it and can undo", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/stash");
  await page.getByTestId(`card-stash-yarn-${fishermanId}`).click();
  await page.getByTestId("input-skeins-left").fill("0");
  await page.getByTestId("button-save-yarn").click();

  await expect(page.getByTestId(`archive-nudge-${fishermanId}`)).toContainText("All used up. Move Lion Brand Wool-Ease Fisherman to your Archive?");
  if (process.env.ARCHIVE_SCREENSHOTS) await page.screenshot({ path: `${process.env.ARCHIVE_SCREENSHOTS}/archive-nudge-web.png` });
  await page.getByTestId("button-move-to-archive").click();
  await expect(page).toHaveURL(/\/stash$/);
  await expect(page.getByTestId("signpost")).toContainText("Moved Lion Brand Wool-Ease Fisherman to your Archive. Find it under Archive on the Yarn stash page.");
  await expect(page.getByTestId(`card-stash-yarn-${fishermanId}`)).toHaveCount(0);
  if (process.env.ARCHIVE_SCREENSHOTS) await page.screenshot({ path: `${process.env.ARCHIVE_SCREENSHOTS}/archive-signpost-web.png` });

  await page.getByTestId("button-archive-filter").click();
  await expect(page.getByTestId(`card-stash-yarn-${fishermanId}`)).toBeVisible();
  await expect(page.getByTestId(`card-stash-yarn-${seaGlassId}`)).toBeVisible();
  await expect(page.getByText("in your Archive")).toBeVisible();

  await page.getByTestId("button-signpost-action").click();
  await expect.poll(() => state.patches.at(-1)).toEqual({ archived: false });
  await page.getByTestId("button-archive-filter").click();
  await expect(page.getByTestId(`card-stash-yarn-${fishermanId}`)).toBeVisible();
});

test("adding a yarn that's in the Archive brings it back instead of making a copy", async ({ page }) => {
  await mockApi(page);
  await page.goto("/stash/new");
  await page.getByTestId("input-stash-photo").setInputFiles({ name: "skein.png", mimeType: "image/png", buffer: photo });
  await page.getByTestId("input-stash-brand").fill("Lion Brand");
  await page.getByTestId("input-stash-sub-brand").fill("Wool-Ease");
  await page.getByTestId("input-stash-color").fill("sea glass");
  await page.getByTestId("input-skeins-purchased").fill("3");
  await page.getByTestId("input-stash-weight").click();
  await page.getByTestId("input-stash-weight-wheel").getByText("4 · Worsted").click();
  await page.getByTestId("input-stash-weight-done").click();
  await page.getByTestId("button-save-yarn").click();
  await expect(page).toHaveURL(/\/stash$/);
  await expect(page.getByTestId("signpost")).toContainText("Welcome back: Lion Brand Wool-Ease sea glass was in your Archive, so it’s back in your stash with your new details.");
  await expect(page.getByTestId(`card-stash-yarn-${seaGlassId}`)).toBeVisible();
});
