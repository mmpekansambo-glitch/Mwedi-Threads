# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: designer-website.spec.ts >> lets a maker replace a saved designer name with a website link when editing
- Location: e2e/designer-website.spec.ts:152:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: getByTestId('link-designer-website')
Expected: "A maker's pattern library"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" getByTestId('link-designer-website') with timeout 5000ms
  - waiting for getByTestId('link-designer-website')

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
  - text: Knitting · PROJECT JOURNAL
  - heading "Wool scarf" [level=1]
  - text: In progress Started when you were ready
  - button "Edit details"
  - button "Delete project"
  - article:
    - text: THE LONG AND LOVELY MIDDLE
    - heading "Look how far you've come." [level=2]
    - paragraph: Your progress doesn't need to be perfect to count.
    - strong: 25%
    - text: complete 〰
  - text: NOTES FROM THE MAKING
  - heading "Progress journal" [level=2]
  - button "Add a note"
  - heading "The first stitch in your journal" [level=3]
  - paragraph: When you've spent a little time with this project, leave yourself a note here.
  - button "Add your first note"
  - complementary:
    - text: A FEW DETAILS
    - heading "On the table" [level=3]
    - term: Pattern
    - definition: Not added yet
    - term: Designer
    - definition: Mara Maker
    - term: Yarn
    - definition: Not added yet
    - term: Tools
    - definition: Not added yet
    - term: Target date
    - definition: No date in mind
    - button "Edit details"
    - paragraph: “Slow work is still beautiful work.”
    - text: YOUR WORKROOM, YOUR PACE
- region "Notifications (F8)":
  - list
```

# Test source

```ts
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
  136 |   await expect(page).toHaveURL(/\/projects\/project-mwedi-e2e$/);
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
> 166 |   await expect(page.getByTestId("link-designer-website")).toHaveText("A maker's pattern library");
      |                                                           ^ Error: expect(locator).toHaveText(expected) failed
  167 |   expect(updatedBody).toMatchObject({
  168 |     patternDesigner: null,
  169 |     designerWebsite: "https://maker.example.org",
  170 |     designerPageTitle: "A maker's pattern library",
  171 |   });
  172 | });
  173 | 
```