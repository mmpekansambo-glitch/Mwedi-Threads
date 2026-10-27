import { expect, test, type Page } from "@playwright/test";

const projectId = "project-hooks-e2e";

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId, title: "Granny square blanket", craft: "crochet", status: "in_progress",
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

async function mockApi(page: Page, current: Record<string, unknown>, sent: { create?: unknown; update?: unknown }) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/projects" && request.method() === "POST") {
      sent.create = request.postDataJSON();
      return route.fulfill({ status: 201, json: project({ ...(sent.create as object) }) });
    }
    if (pathname === `/api/projects/${projectId}` && request.method() === "PATCH") {
      sent.update = request.postDataJSON();
      return route.fulfill({ json: { ...current, ...(sent.update as object) } });
    }
    if (pathname === `/api/projects/${projectId}`) return route.fulfill({ json: { ...current, progress: [] } });
    return route.fulfill({ json: [] });
  });
}

test("saves a second hook size on a new crochet project", async ({ page }) => {
  const sent: { create?: unknown } = {};
  await mockApi(page, project(), sent);
  await page.goto("/projects/new");
  await page.getByTestId("input-project-title").fill("Granny square blanket");
  await page.getByTestId("select-project-craft").selectOption("crochet");
  await page.getByTestId("select-crochet-hook-size").selectOption("5.0 mm (US H-8, UK/Canada 6)");
  await expect(page.getByTestId("select-second-hook-size")).toHaveCount(0);
  await page.getByTestId("button-project-add-second-hook").click();
  await page.getByTestId("select-second-hook-size").selectOption("4.0 mm (US G-6, UK/Canada 8)");
  await expect(page.getByTestId("button-project-add-second-hook")).toHaveCount(0);
  if (process.env.HOOK_SCREENSHOTS) await page.screenshot({ path: `${process.env.HOOK_SCREENSHOTS}/new-project-hooks.png` });
  await page.getByTestId("button-save-project").click();
  await expect.poll(() => sent.create).toMatchObject({
    hookSize: "5.0 mm (US H-8, UK/Canada 6)", secondHookSize: "4.0 mm (US G-6, UK/Canada 8)", needleSize: null,
  });
});

test("shows the second hook on the project page", async ({ page }) => {
  await mockApi(page, project({ hookSize: "5.0 mm (US H-8, UK/Canada 6)", secondHookSize: "4.0 mm (US G-6, UK/Canada 8)" }), {});
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("text-second-hook")).toHaveText("4.0 mm (US G-6, UK/Canada 8)");
  if (process.env.HOOK_SCREENSHOTS) await page.screenshot({ path: `${process.env.HOOK_SCREENSHOTS}/project-page-hooks.png` });
});

test("removing the second hook in Edit details clears it", async ({ page }) => {
  const sent: { update?: unknown } = {};
  await mockApi(page, project({ hookSize: "5.0 mm (US H-8, UK/Canada 6)", secondHookSize: "4.0 mm (US G-6, UK/Canada 8)" }), sent);
  await page.goto(`/projects/${projectId}`);
  await page.getByTestId("button-edit-details").click();
  await expect(page.getByTestId("select-edit-second-hook-size")).toHaveValue("4.0 mm (US G-6, UK/Canada 8)");
  await page.getByTestId("button-edit-remove-second-hook").click();
  await page.getByTestId("button-update-project").click();
  await expect.poll(() => sent.update).toMatchObject({ hookSize: "5.0 mm (US H-8, UK/Canada 6)", secondHookSize: null });
});
