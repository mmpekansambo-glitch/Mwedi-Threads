import { expect, test, type Page, type Route } from "@playwright/test";

type ProjectResponse = {
  id: string;
  ownerId: string;
  title: string;
  craft: "knitting" | "crochet";
  status: "planning" | "in_progress" | "completed";
  description: string | null;
  patternName: string | null;
  patternDesigner: string | null;
  designerWebsite: string | null;
  designerPageTitle: string | null;
  yarn: string | null;
  yarns: Array<Record<string, unknown>>;
  tools: string | null;
  hookSize: string | null;
  needleSize: string | null;
  needleType: string | null;
  needleCableLength: string | null;
  secondNeedleSize: string | null;
  secondNeedleType: string | null;
  secondNeedleCableLength: string | null;
  startedAt: string | null;
  startedAtPrecision: "month" | "day";
  targetDate: string | null;
  targetDatePrecision: "month" | "day";
  progressMethod: "estimate" | "rows" | "sections" | "skeins";
  progressTotal: number | null;
  progressSections: { name: string; done: boolean }[];
  completionPercent: number;
  createdAt: string;
  updatedAt: string;
};

const projectFixture = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: "project-mwedi-e2e",
  ownerId: "user_mwedi_e2e",
  title: "Wool scarf",
  craft: "knitting",
  status: "in_progress",
  description: null,
  patternName: null,
  patternDesigner: null,
  designerWebsite: null,
  designerPageTitle: null,
  yarn: null,
  yarns: [],
  tools: null,
  hookSize: null,
  needleSize: null,
  needleType: null,
  needleCableLength: null,
  secondNeedleSize: null,
  secondNeedleType: null,
  secondNeedleCableLength: null,
  startedAt: null,
  startedAtPrecision: "day",
  targetDate: null,
  targetDatePrecision: "day",
  progressMethod: "estimate",
  progressTotal: null,
  progressSections: [],
  completionPercent: 25,
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-01-10T12:00:00.000Z",
  ...overrides,
});

async function mockProjectApi(
  page: Page,
  onCreate: (body: Record<string, unknown>) => void,
  onUpdate: (body: Record<string, unknown>) => void,
  initialProject: ProjectResponse = projectFixture(),
) {
  let currentProject = initialProject;

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/projects/designer-website-title-preview" && method === "POST") {
      const body = request.postDataJSON() as { websiteUrl: string };
      await route.fulfill({
        status: 200,
        json: {
          websiteUrl: body.websiteUrl,
          pageTitle: "A maker's pattern library",
          designerName: "Maker Example",
        },
      });
      return;
    }

    if (url.pathname === "/api/projects" && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      onCreate(body);
      currentProject = projectFixture({
        ...(body as Partial<ProjectResponse>),
        id: "project-mwedi-e2e",
      });
      await route.fulfill({ status: 201, json: currentProject });
      return;
    }

    if (url.pathname === "/api/projects/project-mwedi-e2e" && method === "GET") {
      await route.fulfill({ status: 200, json: { ...currentProject, progress: [] } });
      return;
    }

    if (url.pathname === "/api/projects/project-mwedi-e2e" && (method === "PATCH" || method === "PUT")) {
      const body = request.postDataJSON() as Record<string, unknown>;
      onUpdate(body);
      currentProject = projectFixture({ ...currentProject, ...(body as Partial<ProjectResponse>) });
      await route.fulfill({ status: 200, json: currentProject });
      return;
    }

    if (url.pathname === "/api/projects" && method === "GET") {
      await route.fulfill({ status: 200, json: [] });
      return;
    }

    if (url.pathname === "/api/dashboard" && method === "GET") {
      await route.fulfill({
        status: 200,
        json: { activeProjects: 0, completedProjects: 0, progressUpdates: 0, recentProjects: [] },
      });
      return;
    }

    await route.fulfill({ status: 404, json: { error: `Unhandled test request: ${method} ${url.pathname}` } });
  });
}

async function pickDate(page: Page, testId: string, month: string, day: string, year: string) {
  await page.getByTestId(testId).click();
  await page.getByTestId(`${testId}-year`).getByRole("option", { name: year, exact: true }).click();
  await page.getByTestId(`${testId}-month`).getByRole("option", { name: month, exact: true }).click();
  await page.getByTestId(`${testId}-day`).getByRole("option", { name: day, exact: true }).click();
  await page.getByTestId(`${testId}-done`).click();
}

test("creates a crochet project with a hook size, date precision, yarn, and a designer website preview", async ({ page }) => {
  let createdBody: Record<string, unknown> | undefined;
  await mockProjectApi(page, (body) => { createdBody = body; }, () => undefined);

  await page.goto("/projects/new");
  await page.getByTestId("input-project-title").fill("Spring shawl");
  await page.getByTestId("select-project-craft").selectOption("crochet");
  await expect(page.getByTestId("select-crochet-hook-size")).toBeVisible();
  await expect(page.getByTestId("input-project-tools")).toBeHidden();
  await page.getByTestId("select-crochet-hook-size").selectOption("4.0 mm (US G-6, UK/Canada 8)");
  await pickDate(page, "input-start-date", "March", "—", "2026");
  await expect(page.getByTestId("input-start-date")).toHaveText("March 2026");
  await pickDate(page, "input-target-date", "May", "17", "2026");
  await expect(page.getByTestId("input-target-date")).toHaveText("May 17, 2026");
  await page.getByTestId("project-yarn-0-brand").fill("Brooklyn Tweed");
  await page.getByTestId("project-yarn-0-sub-brand").fill("Shelter");
  await page.getByTestId("project-yarn-0-color").fill("Cardinal");

  await page.getByTestId("button-create-designer-website").click();
  await page.getByTestId("input-create-designer-website").fill("https://maker.example.org/patterns");
  await page.getByTestId("button-create-preview-designer-title").click();
  await expect(page.getByTestId("designer-page-title-preview")).toContainText("A maker's pattern library");
  await page.getByTestId("button-save-project").click();

  await expect(page).toHaveURL(/\/projects\/project-mwedi-e2e$/);
  await expect(page.getByTestId("link-designer-website")).toHaveText("A maker's pattern library");
  expect(createdBody).toMatchObject({
    patternDesigner: "Maker Example",
    designerWebsite: "https://maker.example.org/patterns",
    designerPageTitle: "A maker's pattern library",
    startedAt: "2026-03-01",
    startedAtPrecision: "month",
    targetDate: "2026-05-17",
    targetDatePrecision: "day",
    hookSize: "4.0 mm (US G-6, UK/Canada 8)",
    yarns: [{ stashYarnId: null, brand: "Brooklyn Tweed", subBrand: "Shelter", color: "Cardinal", heldTogether: false, skeinsUsed: null }],
  });
});

test("lets a maker replace a saved designer name with a website link when editing", async ({ page }) => {
  let updatedBody: Record<string, unknown> | undefined;
  const existingProject = projectFixture({
    craft: "crochet",
    patternDesigner: "Mara Maker",
    hookSize: "4.0 mm (US G-6, UK/Canada 8)",
  });
  await mockProjectApi(page, () => undefined, (body) => { updatedBody = body; }, existingProject);

  await page.goto("/projects/project-mwedi-e2e");
  await expect(page.getByTestId("button-edit-project")).toBeVisible();
  await page.getByTestId("button-edit-project").click();
  await page.getByTestId("select-edit-crochet-hook-size").selectOption("4.5 mm (US 7, UK/Canada 7)");
  await page.getByTestId("button-edit-designer-website").click();
  await page.getByTestId("input-edit-designer-website").fill("https://maker.example.org");
  await page.getByTestId("button-edit-preview-designer-title").click();
  await expect(page.getByTestId("designer-page-title-preview")).toContainText("A maker's pattern library");
  await page.getByTestId("button-update-project").click();

  await expect(page.getByTestId("link-designer-website")).toHaveText("A maker's pattern library");
  expect(updatedBody).toMatchObject({
    patternDesigner: "Maker Example",
    designerWebsite: "https://maker.example.org",
    designerPageTitle: "A maker's pattern library",
    hookSize: "4.5 mm (US 7, UK/Canada 7)",
  });
});

test("uses the inferred designer name when a saved page title is too long", async ({ page }) => {
  const websiteUrl = "https://maker.example.org/patterns";
  await mockProjectApi(
    page,
    () => undefined,
    () => undefined,
    projectFixture({
      designerWebsite: websiteUrl,
      designerPageTitle: "A very long title that does not clearly identify which pattern this project uses",
      patternDesigner: "Maker Example",
    }),
  );

  await page.goto("/projects/project-mwedi-e2e");

  const designerLink = page.getByTestId("link-designer-website");
  await expect(designerLink).toHaveText("Maker Example");
  await expect(designerLink).toHaveAttribute("href", websiteUrl);
});
