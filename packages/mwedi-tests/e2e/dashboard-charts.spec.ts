import { expect, test, type Page, type Route } from "@playwright/test";

const months = [
  "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
  "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
];
const weeks = [
  "2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31",
  "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12",
];

function dashboard(charts: {
  projectsByStatus?: number[];
  completedPerMonth?: number[];
  completedWithoutDate?: number;
  progressPerWeek?: number[];
}) {
  const statuses = ["planning", "in_progress", "paused", "completed"] as const;
  return {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    recentProjects: [],
    recentProgress: [],
    charts: {
      projectsByStatus: statuses.map((status, index) => ({
        status,
        count: charts.projectsByStatus?.[index] ?? 0,
      })),
      completedPerMonth: months.map((month, index) => ({
        month,
        count: charts.completedPerMonth?.[index] ?? 0,
      })),
      completedWithoutDate: charts.completedWithoutDate ?? 0,
      progressPerWeek: weeks.map((weekStart, index) => ({
        weekStart,
        count: charts.progressPerWeek?.[index] ?? 0,
      })),
    },
  };
}

async function mockDashboard(page: Page, body: ReturnType<typeof dashboard>) {
  await page.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/dashboard") {
      await route.fulfill({ status: 200, json: body });
      return;
    }
    await route.fulfill({ status: 404, json: { error: `Unhandled test request: ${url.pathname}` } });
  });
}

test("draws the three dashboard charts with month and week labels", async ({ page }) => {
  await mockDashboard(page, dashboard({
    projectsByStatus: [2, 3, 1, 4],
    completedPerMonth: [0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1],
    completedWithoutDate: 2,
    progressPerWeek: [1, 0, 2, 3, 0, 0, 1, 4, 2, 0, 3, 5],
  }));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/dashboard");

  const status = page.getByTestId("chart-projects-by-status");
  await expect(status.getByRole("heading", { name: "Projects by status" })).toBeVisible();
  await expect(status.locator(".recharts-bar-rectangle")).toHaveCount(4);
  await expect(status.getByText("On pause").first()).toBeVisible();

  const monthly = page.getByTestId("chart-completed-per-month");
  await expect(monthly.locator(".recharts-bar-rectangle")).toHaveCount(12);
  await expect(monthly.getByText("2 finished projects have no completed date, so they aren’t counted here.")).toBeVisible();

  const weekly = page.getByTestId("chart-progress-per-week");
  await expect(weekly.locator(".recharts-bar-rectangle")).toHaveCount(12);
  await expect(weekly.getByText("Oct 12").first()).toBeAttached();

  if (process.env.DASHBOARD_SCREENSHOT) {
    await page.locator(".chart-row").screenshot({ path: process.env.DASHBOARD_SCREENSHOT });
  }
});

test("shows a friendly note on each chart when there is nothing to draw yet", async ({ page }) => {
  await mockDashboard(page, dashboard({}));
  await page.goto("/dashboard");

  await expect(page.getByText("Add your first project and it will show up here.")).toBeVisible();
  await expect(page.getByText("Nothing finished in the last year yet. Your first finish will land here.")).toBeVisible();
  await expect(page.getByText("No progress notes in the last 12 weeks. Add one from any project page.")).toBeVisible();
  await expect(page.locator(".recharts-bar-rectangle")).toHaveCount(0);
});
