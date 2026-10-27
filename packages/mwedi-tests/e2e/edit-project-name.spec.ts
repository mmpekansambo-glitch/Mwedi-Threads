import { expect, test } from "@playwright/test";

const projectId = "project-name-e2e";

const project = {
  id: projectId, title: "Juniper cardigan", craft: "crochet", status: "in_progress",
  description: null, patternName: null, patternDesigner: null, designerWebsite: null, designerPageTitle: null,
  yarn: null, yarns: [], tools: null, hookSize: null, secondHookSize: null,
  needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
  startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day",
  completedAt: null, completedAtPrecision: "day", starred: false,
  progressMethod: "estimate", progressTotal: null, progressSections: [],
  completionPercent: 25, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
};

test("Edit details shows an error and does not save when the name is cleared", async ({ page }) => {
  let patched = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === `/api/projects/${projectId}` && request.method() === "PATCH") {
      patched = true;
      return route.fulfill({ json: { ...project, ...request.postDataJSON() } });
    }
    if (pathname === `/api/projects/${projectId}`) return route.fulfill({ json: { ...project, progress: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/projects/${projectId}`);
  await page.getByTestId("button-edit-details").click();
  await expect(page.getByTestId("error-edit-title")).toHaveCount(0);

  await page.getByTestId("input-edit-title").fill("   ");
  await page.getByTestId("button-update-project").click();
  await expect(page.getByTestId("error-edit-title")).toHaveText("Your project needs a name.");
  await expect(page.getByTestId("input-edit-title")).toHaveAttribute("aria-invalid", "true");
  expect(patched).toBe(false);

  await page.getByTestId("input-edit-title").fill("Juniper vest");
  await page.getByTestId("button-update-project").click();
  await expect.poll(() => patched).toBe(true);
});
