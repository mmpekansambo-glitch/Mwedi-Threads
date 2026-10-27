import { expect, test, type Page } from "@playwright/test";

const shots = process.env.DARK_SCREENSHOTS;
const projectId = "dark-mode-project";

const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const weeks = ["2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"];

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId, title: "Granny square cardigan", craft: "crochet", status: "in_progress",
    description: null, patternName: "Granny cardigan", patternDesigner: null, designerWebsite: null, designerPageTitle: null,
    yarn: null, yarns: [], tools: null, hookSize: "4.0 mm (US G-6)", secondHookSize: null,
    needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
    startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day",
    completedAt: null, completedAtPrecision: "day", starred: true,
    progressMethod: "rows", progressTotal: 60, progressSections: [],
    completionPercent: 40, counter: 26, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
    progress: [],
    ...overrides,
  };
}

const projects = [
  project(),
  project({ id: "dark-mode-beanie", title: "Cabled beanie", craft: "knitting", status: "planning", starred: false, completionPercent: 0 }),
  project({ id: "dark-mode-tote", title: "Market tote", status: "completed", starred: false, completionPercent: 100 }),
];

const dashboard = {
  totalProjects: 3, activeProjects: 1, completedProjects: 1, recentProjects: projects, recentProgress: [],
  charts: {
    projectsByStatus: (["planning", "in_progress", "paused", "completed"] as const).map((status, index) => ({ status, count: [1, 1, 0, 1][index] })),
    completedPerMonth: months.map((month, index) => ({ month, count: [0, 1, 0, 2, 1, 0, 1, 3, 0, 1, 2, 1][index] })),
    completedWithoutDate: 0,
    progressPerWeek: weeks.map((weekStart, index) => ({ weekStart, count: [1, 2, 0, 3, 2, 4, 1, 2, 3, 1, 2, 4][index] })),
  },
};

const floral = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#2F4F8F"/>${[[20, 20], [60, 15], [100, 25], [35, 55], [80, 60], [15, 80], [110, 78]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="4" fill="#F1E6CF"/>${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="3" ry="6" cy="-7" fill="#E58FB0" transform="rotate(${a})"/>`).join("")}</g>`).join("")}</svg>`;
const fabric = {
  id: "cccccccc-0000-4000-8000-000000000001", fabricType: "cotton", construction: "woven", print: "floral", generalColor: "blue", unit: "meters",
  amount: 2.5, width: 145, brand: "Liberty", notes: null, photoCount: 1, createdAt: "2026-10-20T12:00:00.000Z", updatedAt: "2026-10-20T12:00:00.000Z",
};

async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/api/me/crafts") return route.fulfill({ json: { yarn: true, sewing: true, needsChoice: false } });
    if (pathname === "/api/dashboard") return route.fulfill({ json: dashboard });
    if (pathname === "/api/projects") return route.fulfill({ json: projects });
    if (pathname === `/api/projects/${projectId}`) return route.fulfill({ json: project() });
    if (pathname === "/api/fabric-stash") return route.fulfill({ json: [fabric] });
    if (/^\/api\/fabric-stash\/[^/]+\/photos\/\d$/.test(pathname)) return route.fulfill({ contentType: "image/svg+xml", body: floral });
    return route.fulfill({ json: [] });
  });
}

// Lets the page's settle-in animation finish before a screenshot.
const settle = (page: Page) => page.waitForTimeout(900);
const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));

test("follows the computer's dark setting in the signed-in app", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.emulateMedia({ colorScheme: "dark" });
  await mockApi(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Projects by status" })).toBeVisible();
  expect(await isDark(page)).toBe(true);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(24, 33, 38)");
  await expect(page.locator(".side-rail")).toHaveCSS("background-color", "rgb(16, 23, 27)");
  if (shots) await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/dashboard-dark.png` });

  await page.goto("/projects");
  await expect(page.getByText("Cabled beanie")).toBeVisible();
  if (shots) await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/projects-dark.png` });

  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("text-counter")).toHaveText("26");
  if (shots) await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/project-dark.png` });

  await page.goto("/sewing/fabric");
  await expect(page.getByText("Cotton, floral")).toBeVisible();
  if (shots) await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/fabric-stash-dark.png` });
});

test("the Sewing room is mauve in light mode", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.emulateMedia({ colorScheme: "light" });
  await mockApi(page);
  await page.goto("/sewing/fabric");
  await expect(page.getByText("Cotton, floral")).toBeVisible();
  expect(await isDark(page)).toBe(false);
  await expect(page.locator(".portal-shell")).toHaveCSS("background-color", "rgb(228, 222, 239)");
  await expect(page.locator(".side-rail")).toHaveCSS("background-color", "rgb(74, 60, 102)");
  if (shots) await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/fabric-stash-light.png` });
});

test("Appearance in Settings overrides the computer and is remembered", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.emulateMedia({ colorScheme: "light" });
  await mockApi(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Projects by status" })).toBeVisible();
  expect(await isDark(page)).toBe(false);

  await page.getByTestId("button-profile-menu").click();
  await expect(page.getByTestId("button-appearance-system")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("button-appearance-dark").click();
  expect(await isDark(page)).toBe(true);
  if (shots) await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/settings-menu-dark.png`, clip: { x: 0, y: 360, width: 300, height: 500 } });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Projects by status" })).toBeVisible();
  expect(await isDark(page)).toBe(true);

  await page.getByTestId("button-profile-menu").click();
  await page.getByTestId("button-appearance-system").click();
  expect(await isDark(page)).toBe(false);
});
