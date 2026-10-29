import { expect, test, type Page } from "@playwright/test";

function yarn(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, brand: "Carron", subBrand: "Simply Soft", color: "Grape", generalColor: "purple", weight: "worsted",
    blend: [{ fiber: "Acrylic", percent: 100 }], brandLink: null, photoPath: `/objects/stash/user/${id}`,
    skeinsPurchased: 3, skeinsLeft: 3, createdAt: "2026-10-28T12:00:00.000Z", updatedAt: "2026-10-28T12:00:00.000Z",
    ...overrides,
  };
}

const grapeId = "bbbbbbbb-0000-4000-8000-000000000001";

// A small in-memory stash. The list answers slowly, like a phone on a weak
// connection, so the page has to show the saved change before it arrives.
async function mockApi(page: Page) {
  const state = {
    stash: [
      yarn(grapeId),
      yarn("bbbbbbbb-0000-4000-8000-000000000002", { color: "Lemonade", generalColor: "yellow" }),
      yarn("bbbbbbbb-0000-4000-8000-000000000003", { brand: "Cascade", subBrand: "220", color: "Lime", generalColor: "green" }),
    ],
    renames: [] as unknown[],
    slowList: false,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/yarn-catalog") {
      return route.fulfill({ json: { brands: [], subBrands: [], colors: [], fibers: ["Acrylic"], suggestions: { brand: "Carron", subBrand: null, color: null } } });
    }
    if (pathname === "/api/yarn-stash/rename-all") {
      const body = request.postDataJSON();
      state.renames.push(body);
      let renamed = 0;
      state.stash = state.stash.map((item) => {
        if (body.field !== "brand" || item.brand !== body.from) return item;
        renamed += 1;
        return { ...item, brand: body.to };
      });
      return route.fulfill({ json: { renamed } });
    }
    if (pathname.endsWith("/photo")) return route.fulfill({ status: 404, body: "" });
    if (pathname === "/api/yarn-stash") {
      const snapshot = structuredClone(state.stash);
      if (state.slowList) await new Promise((resolve) => setTimeout(resolve, 2500));
      return route.fulfill({ json: snapshot });
    }
    const itemMatch = pathname.match(/^\/api\/yarn-stash\/([^/]+)$/);
    if (itemMatch && request.method() === "PATCH") {
      const changes = request.postDataJSON();
      state.stash = state.stash.map((item) => (item.id === itemMatch[1] ? { ...item, ...changes, updatedAt: "2026-10-29T12:00:00.000Z" } : item));
      return route.fulfill({ json: state.stash.find((item) => item.id === itemMatch[1]) });
    }
    if (itemMatch) return route.fulfill({ json: state.stash.find((item) => item.id === itemMatch[1]) });
    return route.fulfill({ json: [] });
  });
  return state;
}

test("keeps a renamed brand, offers to rename the other yarns and shows it on the stash at once", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/stash");
  await page.getByTestId(`card-stash-yarn-${grapeId}`).click();
  await page.getByTestId("input-stash-brand").fill("Caron");
  // The old name isn't offered back while renaming away from it.
  await expect(page.getByTestId("button-did-you-mean-brand")).toHaveCount(0);
  await page.getByTestId("button-save-yarn").click();

  const offer = page.getByTestId("rename-offer");
  await expect(offer).toContainText("You have 1 other yarn with the old name. Rename Carron to Caron on it too? Each keeps its own color.");
  if (process.env.RENAME_SCREENSHOTS) await page.screenshot({ path: `${process.env.RENAME_SCREENSHOTS}/rename-offer-web.png`, fullPage: true });

  state.slowList = true;
  await page.getByTestId("button-rename-others").click();
  expect(state.renames).toEqual([{ field: "brand", from: "Carron", to: "Caron" }]);
  await expect(page).toHaveURL(/\/stash$/);
  await expect(page.getByTestId(`card-stash-yarn-${grapeId}`)).toContainText("Caron Simply Soft", { timeout: 1000 });
  await expect(page.getByTestId("card-stash-yarn-bbbbbbbb-0000-4000-8000-000000000002")).toContainText("Caron Simply Soft");
});

test("goes straight back when no other yarn has the old name", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/stash");
  await page.getByTestId("card-stash-yarn-bbbbbbbb-0000-4000-8000-000000000003").click();
  state.slowList = true;
  await page.getByTestId("input-stash-brand").fill("Cascade Yarns");
  await page.getByTestId("button-save-yarn").click();
  await expect(page).toHaveURL(/\/stash$/);
  await expect(page.getByTestId("rename-offer")).toHaveCount(0);
  expect(state.renames).toEqual([]);
  await expect(page.getByTestId("card-stash-yarn-bbbbbbbb-0000-4000-8000-000000000003")).toContainText("Cascade Yarns 220", { timeout: 1000 });
});
