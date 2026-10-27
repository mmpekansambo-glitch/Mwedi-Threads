import { expect, test, type Page } from "@playwright/test";

const projectId = "project-counter-e2e";

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId, title: "Granny square cardigan", craft: "crochet", status: "in_progress",
    description: null, patternName: "Granny cardigan", patternDesigner: null, designerWebsite: null, designerPageTitle: null,
    yarn: null, yarns: [], tools: null, hookSize: "4.0 mm (US G-6)", secondHookSize: null,
    needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
    startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day",
    completedAt: null, completedAtPrecision: "day", starred: false,
    progressMethod: "rows", progressTotal: 60, progressSections: [],
    completionPercent: 40, counter: 24, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
    progress: [],
    ...overrides,
  };
}

async function mockApi(page: Page, saved: number[]) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === `/api/projects/${projectId}/counter` && request.method() === "PUT") {
      const { count } = request.postDataJSON() as { count: number };
      saved.push(count);
      return route.fulfill({ json: { count } });
    }
    if (pathname === `/api/projects/${projectId}`) return route.fulfill({ json: project() });
    return route.fulfill({ json: [] });
  });
}

test("counts up and down on the project page and saves the count", async ({ page }) => {
  const saved: number[] = [];
  await mockApi(page, saved);
  await page.goto(`/projects/${projectId}`);
  const count = page.getByTestId("text-counter");
  await expect(count).toHaveText("24");

  await page.getByTestId("button-counter-plus").click();
  await page.getByTestId("button-counter-plus").click();
  await page.getByTestId("button-counter-minus").click();
  await expect(count).toHaveText("25");
  // Quick taps are saved together once the maker pauses.
  await expect.poll(() => saved).toEqual([25]);

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Space");
  await expect(count).toHaveText("26");
  await expect.poll(() => saved.at(-1)).toBe(26);
  if (process.env.COUNTER_SCREENSHOTS) await page.screenshot({ path: `${process.env.COUNTER_SCREENSHOTS}/web-project-counter.png` });

  await page.getByTestId("button-counter-reset").click();
  await expect(count).toHaveText("0");
  await expect(page.getByTestId("button-counter-minus")).toBeDisabled();
  await page.getByTestId("button-counter-undo").click();
  await expect(count).toHaveText("26");
  await expect.poll(() => saved.at(-1)).toBe(26);
});

test("the space bar doesn't count while typing a note", async ({ page }) => {
  const saved: number[] = [];
  await mockApi(page, saved);
  await page.goto(`/projects/${projectId}`);
  await page.getByTestId("button-add-progress").click();
  await page.getByTestId("input-progress-notes").fill("Two rows done");
  await expect(page.getByTestId("text-counter")).toHaveText("24");
});
