import { expect, test, type Page } from "@playwright/test";

function project(id: string, title: string, createdAt: string, updatedAt: string) {
  return {
    id, title, craft: "crochet", status: "in_progress",
    description: null, patternName: null, patternDesigner: null, designerWebsite: null, designerPageTitle: null,
    yarn: null, yarns: [], tools: null, hookSize: null, secondHookSize: null,
    needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
    startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day",
    completedAt: null, completedAtPrecision: "day", starred: false,
    progressMethod: "estimate", progressTotal: null, progressSections: [],
    completionPercent: 40, createdAt, updatedAt,
  };
}

// The API lists both pages by last updated.
const projects = [
  project("p-blanket", "Striped blanket", "2026-09-01T00:00:00.000Z", "2026-10-19T00:00:00.000Z"),
  project("p-hat", "Autumn hat", "2026-10-10T00:00:00.000Z", "2026-10-12T00:00:00.000Z"),
  project("p-cardigan", "Juniper cardigan", "2026-09-20T00:00:00.000Z", "2026-10-01T00:00:00.000Z"),
];

function yarn(id: string, brand: string, subBrand: string, color: string, weight: string | null, skeinsLeft: number | null, updatedAt: string) {
  return {
    id, brand, subBrand, color, generalColor: null, weight, blend: [], brandLink: null, photoPath: null,
    skeinsPurchased: skeinsLeft === null ? null : 6, skeinsLeft, createdAt: updatedAt, updatedAt,
  };
}

const stash = [
  yarn("y-malabrigo", "Malabrigo", "Rios", "Azul Profundo", "worsted", 1, "2026-10-19T00:00:00.000Z"),
  yarn("y-cascade", "Cascade", "220 Superwash", "Lime", "dk", 5, "2026-10-15T00:00:00.000Z"),
  yarn("y-knitpicks", "Knit Picks", "Brava", "Cotton Candy", null, null, "2026-10-12T00:00:00.000Z"),
  yarn("y-lace", "Lion Brand", "Wool-Ease", "Fisherman", "lace", 3, "2026-10-01T00:00:00.000Z"),
];

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/projects") return route.fulfill({ json: projects });
    if (pathname === "/api/yarn-stash") return route.fulfill({ json: stash });
    return route.fulfill({ json: [] });
  });
}

const order = (page: Page, prefix: string) =>
  page.locator(`[data-testid^="${prefix}"]`).evaluateAll((cards, cut) => cards.map((card) => card.getAttribute("data-testid")!.slice(cut as number)), prefix.length);

test("sorts projects and remembers the choice", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects");
  const sort = page.getByTestId("select-project-sort");
  await expect(sort).toHaveValue("updated");
  await expect.poll(() => order(page, "card-project-")).toEqual(["p-blanket", "p-hat", "p-cardigan"]);

  await sort.selectOption("newest");
  await expect.poll(() => order(page, "card-project-")).toEqual(["p-hat", "p-cardigan", "p-blanket"]);
  await sort.selectOption("oldest");
  await expect.poll(() => order(page, "card-project-")).toEqual(["p-blanket", "p-cardigan", "p-hat"]);
  await sort.selectOption("name");
  await expect.poll(() => order(page, "card-project-")).toEqual(["p-hat", "p-cardigan", "p-blanket"]);
  if (process.env.SORT_SCREENSHOTS) await page.screenshot({ path: `${process.env.SORT_SCREENSHOTS}/projects-sort.png` });

  await page.reload();
  await expect(page.getByTestId("select-project-sort")).toHaveValue("name");
  await expect.poll(() => order(page, "card-project-")).toEqual(["p-hat", "p-cardigan", "p-blanket"]);
});

test("sorts the stash by brand, skeins left and weight", async ({ page }) => {
  await mockApi(page);
  await page.goto("/stash");
  const sort = page.getByTestId("select-stash-sort");
  await expect(sort).toHaveValue("updated");
  await expect.poll(() => order(page, "card-stash-yarn-")).toEqual(["y-malabrigo", "y-cascade", "y-knitpicks", "y-lace"]);

  await sort.selectOption("brand");
  await expect.poll(() => order(page, "card-stash-yarn-")).toEqual(["y-cascade", "y-knitpicks", "y-lace", "y-malabrigo"]);
  await sort.selectOption("skeins");
  await expect.poll(() => order(page, "card-stash-yarn-")).toEqual(["y-cascade", "y-lace", "y-malabrigo", "y-knitpicks"]);
  await sort.selectOption("weight");
  await expect.poll(() => order(page, "card-stash-yarn-")).toEqual(["y-lace", "y-cascade", "y-malabrigo", "y-knitpicks"]);
  if (process.env.SORT_SCREENSHOTS) await page.screenshot({ path: `${process.env.SORT_SCREENSHOTS}/stash-sort.png` });

  await page.reload();
  await expect(page.getByTestId("select-stash-sort")).toHaveValue("weight");
});
