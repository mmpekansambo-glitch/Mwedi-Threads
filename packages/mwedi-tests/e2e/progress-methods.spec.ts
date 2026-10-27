import { expect, test, type Page } from "@playwright/test";

const projectId = "project-progress-e2e";

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId, title: "Raglan sweater", craft: "knitting", status: "in_progress",
    description: null, patternName: null, patternDesigner: null, designerWebsite: null, designerPageTitle: null,
    yarn: null, yarns: [], tools: null, hookSize: null, secondHookSize: null,
    needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
    startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day",
    completedAt: null, completedAtPrecision: "day", starred: false,
    progressMethod: "estimate", progressTotal: null, progressSections: [],
    completionPercent: 25, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

async function mockApi(page: Page, current: Record<string, unknown>, sent: { create?: unknown; progress?: unknown }) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/projects" && request.method() === "POST") {
      sent.create = request.postDataJSON();
      return route.fulfill({ status: 201, json: project({ ...(sent.create as object) }) });
    }
    if (pathname === `/api/projects/${projectId}/progress` && request.method() === "POST") {
      sent.progress = request.postDataJSON();
      return route.fulfill({ status: 201, json: { id: "entry-1", projectId, notes: "", photoPath: null, completionPercent: 25, progressValue: null, createdAt: "2026-10-12T12:00:00.000Z" } });
    }
    if (pathname === `/api/projects/${projectId}`) return route.fulfill({ json: { ...current, progress: [] } });
    return route.fulfill({ json: [] });
  });
}

test("asks for a total when a new project tracks rows or rounds", async ({ page }) => {
  const sent: { create?: unknown } = {};
  await mockApi(page, project(), sent);
  await page.goto("/projects/new");
  await page.getByTestId("input-project-title").fill("Raglan sweater");
  await page.getByTestId("button-create-progress-rows").click();
  await page.getByTestId("button-save-project").click();
  await expect(page.getByRole("alert")).toHaveText("Add how many rows or rounds the project has.");
  expect(sent.create).toBeUndefined();

  await page.getByTestId("input-create-progress-total").fill("200");
  await page.getByTestId("button-save-project").click();
  await expect.poll(() => sent.create).toMatchObject({ progressMethod: "rows", progressTotal: 200, progressSections: [] });
});

test("records the row or round reached in a progress note", async ({ page }) => {
  const sent: { progress?: unknown } = {};
  await mockApi(page, project({ progressMethod: "rows", progressTotal: 200 }), sent);
  await page.goto(`/projects/${projectId}`);
  await page.getByTestId("button-add-progress").click();
  await page.getByTestId("input-progress-notes").fill("Finished the yoke");
  await page.getByTestId("input-progress-value").fill("50");
  await expect(page.getByText("of 200 · 25%")).toBeVisible();
  await page.getByTestId("button-save-progress").click();
  await expect.poll(() => sent.progress).toEqual({ notes: "Finished the yoke", progressValue: 50 });
});

test("ticks off pattern sections in a progress note", async ({ page }) => {
  const sent: { progress?: unknown } = {};
  await mockApi(page, project({
    progressMethod: "sections",
    progressSections: [{ name: "Back", done: true }, { name: "Front", done: false }, { name: "Sleeves", done: false }],
  }), sent);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("text-progress-detail")).toHaveText("1 of 3 sections done");
  await page.getByTestId("button-add-progress").click();
  await page.getByTestId("input-progress-notes").fill("Front is done");
  await expect(page.getByTestId("checkbox-section-0")).toBeChecked();
  await page.getByTestId("checkbox-section-1").check();
  await page.getByTestId("button-save-progress").click();
  await expect.poll(() => sent.progress).toEqual({ notes: "Front is done", sectionsDone: [0, 1] });
});
