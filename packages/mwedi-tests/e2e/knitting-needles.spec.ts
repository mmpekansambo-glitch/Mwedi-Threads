import { expect, test, type Page } from "@playwright/test";

const projectId = "project-needles-e2e";

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId, title: "Ribbed hat", craft: "knitting", status: "in_progress",
    description: null, patternName: null, patternDesigner: null, designerWebsite: null, designerPageTitle: null,
    yarn: null, yarnBrand: null, yarnType: null, yarnColor: null, tools: null, hookSize: null,
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

test("saves a main needle with cable length and a second needle", async ({ page }) => {
  const sent: { create?: unknown } = {};
  await mockApi(page, project(), sent);
  await page.goto("/projects/new");
  await page.getByTestId("input-project-title").fill("Ribbed hat");
  await expect(page.getByTestId("select-needle-cable")).toHaveCount(0);
  await page.getByTestId("select-needle-size").selectOption("4.0 mm (US 6, UK/Canada 8)");
  await page.getByTestId("select-needle-type").selectOption("circular");
  await page.getByTestId("select-needle-cable").selectOption("40 cm (16 in)");
  await page.getByTestId("button-project-add-second-needle").click();
  await page.getByTestId("select-second-needle-size").selectOption("3.25 mm (US 3, UK/Canada 10)");
  await page.getByTestId("select-second-needle-type").selectOption("double_pointed");
  await expect(page.getByTestId("select-second-needle-cable")).toHaveCount(0);
  if (process.env.NEEDLE_SCREENSHOTS) await page.screenshot({ path: `${process.env.NEEDLE_SCREENSHOTS}/new-project-needles.png`, fullPage: true });
  await page.getByTestId("button-save-project").click();
  await expect.poll(() => sent.create).toMatchObject({
    tools: null, hookSize: null,
    needleSize: "4.0 mm (US 6, UK/Canada 8)", needleType: "circular", needleCableLength: "40 cm (16 in)",
    secondNeedleSize: "3.25 mm (US 3, UK/Canada 10)", secondNeedleType: "double_pointed", secondNeedleCableLength: null,
  });
});

test("shows both needles and an earlier tools note on the project page", async ({ page }) => {
  await mockApi(page, project({
    tools: "Stitch markers",
    needleSize: "4.0 mm (US 6, UK/Canada 8)", needleType: "circular", needleCableLength: "40 cm (16 in)",
    secondNeedleSize: "3.25 mm (US 3, UK/Canada 10)", secondNeedleType: "double_pointed",
  }), {});
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("text-needle")).toHaveText("4.0 mm (US 6, UK/Canada 8) · Circular, 40 cm (16 in)");
  await expect(page.getByTestId("text-second-needle")).toHaveText("3.25 mm (US 3, UK/Canada 10) · Double-pointed");
  await expect(page.getByText("Stitch markers")).toBeVisible();
  if (process.env.NEEDLE_SCREENSHOTS) await page.screenshot({ path: `${process.env.NEEDLE_SCREENSHOTS}/project-page-needles.png`, fullPage: true });
});

test("removing the second needle in Edit details clears it", async ({ page }) => {
  const sent: { update?: unknown } = {};
  await mockApi(page, project({
    needleSize: "4.0 mm (US 6, UK/Canada 8)", needleType: "straight",
    secondNeedleSize: "3.25 mm (US 3, UK/Canada 10)", secondNeedleType: "straight",
  }), sent);
  await page.goto(`/projects/${projectId}`);
  await page.getByTestId("button-edit-details").click();
  await expect(page.getByTestId("select-edit-second-needle-size")).toHaveValue("3.25 mm (US 3, UK/Canada 10)");
  await page.getByTestId("button-edit-remove-second-needle").click();
  await page.getByTestId("button-update-project").click();
  await expect.poll(() => sent.update).toMatchObject({ needleSize: "4.0 mm (US 6, UK/Canada 8)", needleType: "straight", secondNeedleSize: null, secondNeedleType: null });
});
