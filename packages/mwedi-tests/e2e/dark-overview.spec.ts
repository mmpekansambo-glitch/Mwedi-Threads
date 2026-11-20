import { expect, test, type Page } from "@playwright/test";

// Dark mode Overview (issue: dark mode less monotonous), in the open layout
// from #119: the counts are words, notes are pinned swatches with their own
// tints, and the status chart has one color per status.
const shots = process.env.OVERVIEW_SCREENSHOTS;

const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const weeks = ["2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"];

const project = (id: string, title: string, status: string) => ({
  id, title, craft: "crochet", status, description: null, patternName: "Granny cardigan", patternDesigner: null, designerWebsite: null, designerPageTitle: null,
  yarn: null, yarns: [], tools: null, hookSize: "4.0 mm (US G-6)", secondHookSize: null,
  needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
  startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day", completedAt: null, completedAtPrecision: "day", starred: false,
  progressMethod: "rows", progressTotal: 60, progressSections: [], completionPercent: 40, counter: 26,
  createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", progress: [],
});
const projects = [project("p1", "Granny square cardigan", "in_progress"), project("p2", "Cabled beanie", "planning"), project("p3", "Market tote", "completed")];

const dashboard = {
  totalProjects: 7, activeProjects: 4, completedProjects: 2, recentProjects: projects, recentProgress: [
    { projectId: "p1", projectTitle: "Granny square cardigan", notes: "Finished the second sleeve panel.", completionPercent: 40, createdAt: "2026-10-30T12:00:00.000Z" },
    { projectId: "p2", projectTitle: "Cabled beanie", notes: "Swatched the cable pattern.", completionPercent: 5, createdAt: "2026-10-28T12:00:00.000Z" },
  ],
  mostUsedYarnBrands: ["Caron"], mostUsedYarnBrandProjects: 3, averageDaysToFinish: 24,
  charts: {
    projectsByStatus: (["planning", "in_progress", "paused", "completed"] as const).map((status, index) => ({ status, count: [1, 4, 0, 2][index] })),
    completedPerMonth: months.map((month, index) => ({ month, count: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0][index] })),
    completedWithoutDate: 0,
    progressPerWeek: weeks.map((weekStart, index) => ({ weekStart, count: [0, 0, 0, 1, 0, 0, 0, 0, 2, 0, 2, 5][index] })),
  },
};

const week = { goal: 4, weekStart: "2026-10-26", days: [true, true, false, false, false, false, false], count: 2, todayCounted: false, weeksInARow: 0 };

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/me/crafts") return route.fulfill({ json: { yarn: true, sewing: true, needsChoice: false } });
    if (pathname === "/api/dashboard") return route.fulfill({ json: dashboard });
    if (pathname === "/api/weekly-goal") return route.fulfill({ json: week });
    if (pathname === "/api/sewing-overview") return route.fulfill({ json: {
      inProgress: 2, finished: 1, fabricPieces: 3, fabricLength: 7.5, fabricUnit: "meters",
      stages: [{ stage: "prep", count: 0 }, { stage: "cut", count: 1 }, { stage: "sew", count: 1 }, { stage: "fit", count: 0 }, { stage: "finish", count: 0 }],
      fabricTypes: [{ fabricType: "cotton", count: 2 }, { fabricType: "linen", count: 1 }], recentProjects: [],
    } });
    return route.fulfill({ json: [] });
  });
}

const bg = (page: Page, testId: string) => page.getByTestId(testId);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.emulateMedia({ colorScheme: "dark" });
  await mockApi(page);
});

test("Yarn studio Overview in dark mode: counts, pick up, pinned notes and status colors", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Projects by status" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^(Morning|Afternoon|Evening), Sample\.$/);
  await expect(page.getByTestId("link-stat-all")).toHaveText("7 projects");
  await expect(page.getByTestId("link-stat-in-progress")).toHaveText("4 in progress");
  await expect(page.getByTestId("link-pick-up")).toHaveText("Granny square cardigan · row 26");
  // Each pinned note has its own tint from the palette, so dark mode isn't one flat color (#109).
  const tints = await page.locator(".note-swatches .pinned-swatch-body").evaluateAll((notes) => notes.map((note) => getComputedStyle(note).backgroundColor));
  expect(tints).toEqual(["rgb(43, 42, 36)", "rgb(35, 43, 37)"]);
  await expect(bg(page, "card-weekly-goal-yarn").getByRole("heading", { name: "This week" })).toHaveCSS("color", "rgb(232, 234, 229)");
  await expect(page.locator(".weekly-goal-days li.is-done i").first()).toHaveCSS("background-color", "rgb(157, 184, 138)");
  const statusBars = page.getByTestId("chart-projects-by-status").locator("path.recharts-rectangle");
  await expect.poll(async () => new Set(await statusBars.evaluateAll((paths) => paths.map((path) => getComputedStyle(path).fill))).size).toBe(3);
  if (shots) { await page.waitForTimeout(1600); await page.screenshot({ path: `${shots}/overview-dark-web.png` }); await page.screenshot({ path: `${shots}/overview-dark-web-full.png`, fullPage: true }); }
});

test("Sewing room Overview in dark mode keeps Lydia violet and no green", async ({ page }) => {
  await page.goto("/sewing");
  await expect(page.getByTestId("link-sewing-stat-in-progress")).toHaveText("2 in progress");
  await expect(page.getByTestId("link-new-sewing-project")).toHaveCSS("background-color", "rgb(195, 173, 228)");
  await expect(page.locator(".room-hill-3")).toHaveCSS("fill", "rgb(41, 32, 61)");
  if (shots) { await page.waitForTimeout(1600); await page.screenshot({ path: `${shots}/sewing-overview-dark-web.png` }); }
});

test("light mode Overview has light tints", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Projects by status" })).toBeVisible();
  await expect(page.locator(".note-swatches .pinned-swatch-body").first()).toHaveCSS("background-color", "rgb(239, 230, 214)");
  await expect(page.getByTestId("link-new-project")).toHaveCSS("background-color", "rgb(95, 122, 78)");
  if (shots) { await page.waitForTimeout(1600); await page.screenshot({ path: `${shots}/overview-light-web.png` }); await page.screenshot({ path: `${shots}/overview-light-web-full.png`, fullPage: true }); }
});
