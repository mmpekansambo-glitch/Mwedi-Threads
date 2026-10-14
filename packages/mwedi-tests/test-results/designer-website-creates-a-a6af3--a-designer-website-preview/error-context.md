# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: designer-website.spec.ts >> creates a project with date precision, structured yarn, and a designer website preview
- Location: e2e/designer-website.spec.ts:117:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/projects\/project-mwedi-e2e$/
Received string:  "http://127.0.0.1:22863/projects/new?title=Spring+shawl&craft=knitting&status=planning&patternName=&designerWebsite=https%3A%2F%2Fmaker.example.org%2Fpatterns&designerPageTitle=A+maker%27s+pattern+library&yarnBrand=Brooklyn+Tweed&yarnType=Shelter&yarnColor=Cardinal&tools=&description="
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="en">…</html>
       - unexpected value "http://127.0.0.1:22863/projects/new?title=Spring+shawl&craft=knitting&status=planning&patternName=&designerWebsite=https%3A%2F%2Fmaker.example.org%2Fpatterns&designerPageTitle=A+maker%27s+pattern+library&yarnBrand=Brooklyn+Tweed&yarnType=Shelter&yarnColor=Cardinal&tools=&description="

```

```yaml
- complementary:
  - link "Mwedi Threads":
    - /url: /
  - text: YOUR WORKROOM
  - navigation:
    - link "Overview":
      - /url: /dashboard
    - link "My projects":
      - /url: /projects
  - paragraph: Keep the little notes. They become the story.
  - text: S Sample Your workroom
  - button "Sign out"
- main:
  - text: Mwedi Threads / My projects Wed, October 14 S
  - link "Back to projects":
    - /url: /projects
  - text: A FRESH CAST-ON
  - heading "Start a project" [level=1]
  - paragraph: Give your idea a place to take shape.
  - text: "01"
  - heading "The beginnings" [level=2]
  - paragraph: Start with a name and the way you like to make.
  - text: Project name *
  - textbox "Project name *":
    - /placeholder: e.g. Juniper cardigan
  - text: Craft
  - combobox "Craft":
    - option "Knitting" [selected]
    - option "Crochet"
  - text: Where it is now
  - combobox "Where it is now":
    - option "Planning" [selected]
    - option "In progress"
    - option "On pause"
    - option "Finished"
  - text: THE LOVELY DETAILS Pattern name
  - textbox "Pattern name":
    - /placeholder: Pattern or source
  - text: Designer Use a name or link to their website.
  - group "Designer entry option":
    - button "Name" [pressed]
    - button "Website link"
  - text: Designer name
  - textbox "Designer name":
    - /placeholder: Who made the pattern?
  - text: Yarn Keep brand, type, and color easy to find. Brand
  - textbox "Brand":
    - /placeholder: e.g. Cascade
  - text: Type
  - textbox "Type":
    - /placeholder: e.g. Merino DK
  - text: Color
  - textbox "Color":
    - /placeholder: e.g. Oatmeal
  - text: Tools
  - textbox "Tools":
    - /placeholder: Needle or hook size…
  - text: Started on
  - combobox "Started on format":
    - option "MM/YY"
    - option "MM/DD/YY" [selected]
  - textbox "Started on (month, day, and year)"
  - text: Include the day Aiming for (optional)
  - combobox "Aiming for (optional) format":
    - option "MM/YY"
    - option "MM/DD/YY" [selected]
  - textbox "Aiming for (optional) (month, day, and year)"
  - text: Include the day Notes to future you
  - textbox "Notes to future you":
    - /placeholder: What made you fall for this one?
  - link "Maybe later":
    - /url: /projects
  - button "Save this project"
- region "Notifications (F8)":
  - list
```

# Test source

```ts
  36  |   patternDesigner: null,
  37  |   designerWebsite: null,
  38  |   designerPageTitle: null,
  39  |   yarn: null,
  40  |   yarnBrand: null,
  41  |   yarnType: null,
  42  |   yarnColor: null,
  43  |   tools: null,
  44  |   startedAt: null,
  45  |   startedAtPrecision: "day",
  46  |   targetDate: null,
  47  |   targetDatePrecision: "day",
  48  |   completionPercent: 25,
  49  |   createdAt: "2026-01-10T12:00:00.000Z",
  50  |   updatedAt: "2026-01-10T12:00:00.000Z",
  51  |   ...overrides,
  52  | });
  53  | 
  54  | async function mockProjectApi(
  55  |   page: Page,
  56  |   onCreate: (body: Record<string, unknown>) => void,
  57  |   onUpdate: (body: Record<string, unknown>) => void,
  58  |   initialProject: ProjectResponse = projectFixture(),
  59  | ) {
  60  |   let currentProject = initialProject;
  61  | 
  62  |   await page.route("**/api/**", async (route: Route) => {
  63  |     const request = route.request();
  64  |     const url = new URL(request.url());
  65  |     const method = request.method();
  66  | 
  67  |     if (url.pathname === "/api/projects/designer-website-title-preview" && method === "POST") {
  68  |       const body = request.postDataJSON() as { websiteUrl: string };
  69  |       await route.fulfill({
  70  |         status: 200,
  71  |         json: { websiteUrl: body.websiteUrl, pageTitle: "A maker's pattern library" },
  72  |       });
  73  |       return;
  74  |     }
  75  | 
  76  |     if (url.pathname === "/api/projects" && method === "POST") {
  77  |       const body = request.postDataJSON() as Record<string, unknown>;
  78  |       onCreate(body);
  79  |       currentProject = projectFixture({
  80  |         ...(body as Partial<ProjectResponse>),
  81  |         id: "project-mwedi-e2e",
  82  |       });
  83  |       await route.fulfill({ status: 201, json: currentProject });
  84  |       return;
  85  |     }
  86  | 
  87  |     if (url.pathname === "/api/projects/project-mwedi-e2e" && method === "GET") {
  88  |       await route.fulfill({ status: 200, json: { ...currentProject, progress: [] } });
  89  |       return;
  90  |     }
  91  | 
  92  |     if (url.pathname === "/api/projects/project-mwedi-e2e" && (method === "PATCH" || method === "PUT")) {
  93  |       const body = request.postDataJSON() as Record<string, unknown>;
  94  |       onUpdate(body);
  95  |       currentProject = projectFixture({ ...currentProject, ...(body as Partial<ProjectResponse>) });
  96  |       await route.fulfill({ status: 200, json: currentProject });
  97  |       return;
  98  |     }
  99  | 
  100 |     if (url.pathname === "/api/projects" && method === "GET") {
  101 |       await route.fulfill({ status: 200, json: [] });
  102 |       return;
  103 |     }
  104 | 
  105 |     if (url.pathname === "/api/dashboard" && method === "GET") {
  106 |       await route.fulfill({
  107 |         status: 200,
  108 |         json: { activeProjects: 0, completedProjects: 0, progressUpdates: 0, recentProjects: [] },
  109 |       });
  110 |       return;
  111 |     }
  112 | 
  113 |     await route.fulfill({ status: 404, json: { error: `Unhandled test request: ${method} ${url.pathname}` } });
  114 |   });
  115 | }
  116 | 
  117 | test("creates a project with date precision, structured yarn, and a designer website preview", async ({ page }) => {
  118 |   let createdBody: Record<string, unknown> | undefined;
  119 |   await mockProjectApi(page, (body) => { createdBody = body; }, () => undefined);
  120 | 
  121 |   await page.goto("/projects/new");
  122 |   await page.getByTestId("input-project-title").fill("Spring shawl");
  123 |   await page.getByTestId("input-start-date").fill("2026-03-01");
  124 |   await page.getByTestId("input-start-date-precision").selectOption("month");
  125 |   await page.getByTestId("input-target-date").fill("2026-05-17");
  126 |   await page.getByTestId("input-yarn-brand").fill("Brooklyn Tweed");
  127 |   await page.getByTestId("input-yarn-type").fill("Shelter");
  128 |   await page.getByTestId("input-yarn-color").fill("Cardinal");
  129 | 
  130 |   await page.getByTestId("button-create-designer-website").click();
  131 |   await page.getByTestId("input-create-designer-website").fill("https://maker.example.org/patterns");
  132 |   await page.getByTestId("button-create-preview-designer-title").click();
  133 |   await expect(page.getByTestId("designer-page-title-preview")).toContainText("A maker's pattern library");
  134 |   await page.getByTestId("button-save-project").click();
  135 | 
> 136 |   await expect(page).toHaveURL(/\/projects\/project-mwedi-e2e$/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  137 |   await expect(page.getByTestId("link-designer-website")).toHaveText("A maker's pattern library");
  138 |   expect(createdBody).toMatchObject({
  139 |     patternDesigner: null,
  140 |     designerWebsite: "https://maker.example.org/patterns",
  141 |     designerPageTitle: "A maker's pattern library",
  142 |     startedAt: "2026-03-01",
  143 |     startedAtPrecision: "month",
  144 |     targetDate: "2026-05-17",
  145 |     targetDatePrecision: "day",
  146 |     yarnBrand: "Brooklyn Tweed",
  147 |     yarnType: "Shelter",
  148 |     yarnColor: "Cardinal",
  149 |   });
  150 | });
  151 | 
  152 | test("lets a maker replace a saved designer name with a website link when editing", async ({ page }) => {
  153 |   let updatedBody: Record<string, unknown> | undefined;
  154 |   const existingProject = projectFixture({ patternDesigner: "Mara Maker" });
  155 |   await mockProjectApi(page, () => undefined, (body) => { updatedBody = body; }, existingProject);
  156 | 
  157 |   await page.goto("/projects/project-mwedi-e2e");
  158 |   await expect(page.getByTestId("button-edit-project")).toBeVisible();
  159 |   await page.getByTestId("button-edit-project").click();
  160 |   await page.getByTestId("button-edit-designer-website").click();
  161 |   await page.getByTestId("input-edit-designer-website").fill("https://maker.example.org");
  162 |   await page.getByTestId("button-edit-preview-designer-title").click();
  163 |   await expect(page.getByTestId("designer-page-title-preview")).toContainText("A maker's pattern library");
  164 |   await page.getByTestId("button-update-project").click();
  165 | 
  166 |   await expect(page.getByTestId("link-designer-website")).toHaveText("A maker's pattern library");
  167 |   expect(updatedBody).toMatchObject({
  168 |     patternDesigner: null,
  169 |     designerWebsite: "https://maker.example.org",
  170 |     designerPageTitle: "A maker's pattern library",
  171 |   });
  172 | });
  173 | 
```