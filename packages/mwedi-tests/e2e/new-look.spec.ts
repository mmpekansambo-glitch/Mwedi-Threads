import { expect, test, type Page } from "@playwright/test";

// The new look (#118): words-only nav, room backdrops, project names in craft
// fonts when there is no photo, and the landing page's frames and threads.
const project = (id: string, title: string, craft: "crochet" | "knitting") => ({
  id, title, craft, status: "in_progress", description: null, patternName: null, patternDesigner: null, designerWebsite: null, designerPageTitle: null,
  yarn: null, yarns: [], tools: null, hookSize: null, secondHookSize: null,
  needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
  startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day", completedAt: null, completedAtPrecision: "day", starred: false,
  progressMethod: "percent", progressTotal: null, progressSections: [], completionPercent: 20, counter: 0,
  createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", progress: [],
});

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/me/crafts") return route.fulfill({ json: { yarn: true, sewing: true, needsChoice: false } });
    if (pathname === "/api/projects") return route.fulfill({ json: [project("p1", "Sunday cardigan", "crochet"), project("p2", "Moss beanie", "knitting")] });
    return route.fulfill({ json: [] });
  });
}

const fontOf = (page: Page, testId: string) => page.getByTestId(testId).locator(".name-tile").evaluate((tile) => getComputedStyle(tile).fontFamily);

test("projects without a photo show their name in a font from their craft", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Sunday cardigan" })).toBeVisible();
  expect(await fontOf(page, "card-project-p1")).toMatch(/Gluten|Pacifico/);
  expect(await fontOf(page, "card-project-p2")).toMatch(/Silkscreen|Rampart One/);
});

test("status words filter the board (#119)", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByTestId("button-status-all")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("button-status-in_progress").click();
  await expect(page).toHaveURL(/\/projects\?status=in_progress$/);
  await expect(page.getByTestId("button-status-in_progress")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("button-status-all").click();
  await expect(page).toHaveURL(/\/projects$/);
});

test("the nav is words only and each room has its own backdrop", async ({ page }) => {
  await mockApi(page);
  await page.goto("/projects");
  await expect(page.getByTestId("link-projects")).toHaveText("My projects");
  await expect(page.locator(".rail-nav svg")).toHaveCount(0);
  await expect(page.locator(".room-hill-3")).toHaveCSS("fill", "rgb(198, 211, 184)");
  await page.goto("/sewing/patterns");
  await expect(page.locator(".room-hill-3")).toHaveCSS("fill", "rgb(208, 197, 228)");
});

test.describe("landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("mwedi-e2e-signed-out", "1"));
  });

  test("shows the first of three watercolor frames and draws three threads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".landing-frame")).toHaveCount(3);
    await expect(page.locator(".landing-frame.is-showing")).toHaveAttribute("src", /yarn-studio\.webp$/);
    await expect(page.locator(".landing-caption")).toHaveText("In the Yarn studio");
    await expect(page.locator(".landing-thread")).toHaveCount(3);
  });

  test("keeps still with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await page.goto("/");
    await page.clock.runFor(20_000);
    await expect(page.locator(".landing-caption")).toHaveText("In the Yarn studio");
  });
});
