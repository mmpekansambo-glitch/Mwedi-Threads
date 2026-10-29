# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sewing-room.spec.ts >> shows the Sewing room with its own look, switcher and fabric swatches
- Location: e2e/sewing-room.spec.ts:151:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('card-fabric-bbbbbbbb-0000-4000-8000-000000000001')
Expected substring: "Woven · Liberty"
Received string:    "Cotton, floralWoven2.5 m · 145 cm wide"
Timeout: 5000ms

Call log:
  - Expect "toContainText" getByTestId('card-fabric-bbbbbbbb-0000-4000-8000-000000000001') with timeout 5000ms
  - waiting for getByTestId('card-fabric-bbbbbbbb-0000-4000-8000-000000000001')
    14 × locator resolved to <a class="fabric-card lift" href="/sewing/fabric/bbbbbbbb-0000-4000-8000-000000000001" data-testid="card-fabric-bbbbbbbb-0000-4000-8000-000000000001">…</a>
       - unexpected value "Cotton, floralWoven2.5 m · 145 cm wide"

```

```yaml
- link "Cotton, floral print Blue fabric Cotton, floral Woven 2.5 m · 145 cm wide":
  - /url: /sewing/fabric/bbbbbbbb-0000-4000-8000-000000000001
  - img "Cotton, floral print"
  - img "Blue fabric"
  - heading "Cotton, floral" [level=3]
  - text: Woven 2.5 m · 145 cm wide
```

# Test source

```ts
  61  |   let current = crafts;
  62  |   const projects = [
  63  |     sewingProject("cccccccc-0000-4000-8000-000000000001"),
  64  |     sewingProject("cccccccc-0000-4000-8000-000000000002", {
  65  |       title: "Striped tee", status: "planning", stage: "prep", patternName: null, sizeMade: "S", fitChanges: null,
  66  |       fabrics: [{ stashFabricId: stash[1].id, amountUsed: null, fabric: stash[1] }],
  67  |     }),
  68  |   ];
  69  |   // Saved projects get their fabric back from the stash, like the API.
  70  |   const withFabric = (body: Record<string, unknown>) => ({
  71  |     ...body,
  72  |     ...(body.fabrics ? { fabrics: (body.fabrics as ProjectFabric[]).map((item) => ({ ...item, fabric: stash.find((entry) => entry.id === item.stashFabricId) })) } : {}),
  73  |     ...(body.toolIds ? { tools: (body.toolIds as string[]).map((id) => tools.find((entry) => entry.id === id)) } : {}),
  74  |   });
  75  |   await page.route("**/storage.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  76  |   await page.route("**/api/**", async (route) => {
  77  |     const request = route.request();
  78  |     const url = new URL(request.url());
  79  |     const { pathname } = url;
  80  |     if (pathname === "/api/me/crafts") {
  81  |       if (request.method() === "PUT") {
  82  |         const body = request.postDataJSON() as { yarn: boolean; sewing: boolean };
  83  |         sent.crafts.push(body);
  84  |         current = { ...body, needsChoice: false };
  85  |       }
  86  |       return route.fulfill({ json: current });
  87  |     }
  88  |     if (pathname === "/api/fabric-stash/photo-upload") {
  89  |       sent.uploads += 1;
  90  |       return route.fulfill({ json: { uploadURL: "https://storage.test/upload", photoPath: `/objects/fabric/user/bbbbbbbb-0000-4000-8000-0000000000f${sent.uploads}` } });
  91  |     }
  92  |     if (pathname === "/api/fabric-stash" && request.method() === "POST") {
  93  |       sent.create = request.postDataJSON();
  94  |       return route.fulfill({ status: 201, json: fabric("bbbbbbbb-0000-4000-8000-000000000009", sent.create as object) });
  95  |     }
  96  |     const photoMatch = pathname.match(/^\/api\/fabric-stash\/([^/]+)\/photos\/\d$/);
  97  |     if (photoMatch) {
  98  |       const item = stash.find((entry) => entry.id === photoMatch[1]);
  99  |       return route.fulfill({ contentType: "image/svg+xml", body: prints[String(item?.print ?? "floral")] });
  100 |     }
  101 |     if (pathname === "/api/fabric-stash") {
  102 |       const print = url.searchParams.get("print");
  103 |       const type = url.searchParams.get("fabricType");
  104 |       const archived = url.searchParams.get("archived") === "true";
  105 |       return route.fulfill({ json: stash.filter((item) => (!print || item.print === print) && (!type || item.fabricType === type) && Boolean(item.archivedAt) === archived) });
  106 |     }
  107 |     const itemMatch = pathname.match(/^\/api\/fabric-stash\/([^/]+)$/);
  108 |     if (itemMatch && request.method() === "GET") return route.fulfill({ json: stash.find((entry) => entry.id === itemMatch[1]) });
  109 |     if (pathname === "/api/sewing-overview") {
  110 |       return route.fulfill({ json: {
  111 |         inProgress: 1, finished: 0, fabricPieces: 3, fabricLength: 7.37, fabricUnit: "meters",
  112 |         stages: [{ stage: "prep", count: 0 }, { stage: "cut", count: 1 }, { stage: "sew", count: 0 }, { stage: "fit", count: 0 }, { stage: "finish", count: 0 }],
  113 |         fabricTypes: [{ fabricType: "cotton", count: 1 }, { fabricType: "jersey", count: 1 }, { fabricType: "wool", count: 1 }],
  114 |         recentProjects: projects,
  115 |       } });
  116 |     }
  117 |     if (pathname === "/api/sewing-projects" && request.method() === "POST") {
  118 |       const body = request.postDataJSON() as Record<string, unknown>;
  119 |       sent.projectSaves.push(body);
  120 |       const created = sewingProject("cccccccc-0000-4000-8000-000000000009", { stage: "prep", ...withFabric(body) });
  121 |       projects.unshift(created);
  122 |       return route.fulfill({ status: 201, json: created });
  123 |     }
  124 |     if (pathname === "/api/sewing-projects") {
  125 |       const status = url.searchParams.get("status");
  126 |       return route.fulfill({ json: projects.filter((item) => !status || item.status === status) });
  127 |     }
  128 |     const projectMatch = pathname.match(/^\/api\/sewing-projects\/([^/]+)$/);
  129 |     if (projectMatch) {
  130 |       const index = projects.findIndex((entry) => entry.id === projectMatch[1]);
  131 |       if (request.method() === "PATCH") {
  132 |         const body = request.postDataJSON() as Record<string, unknown>;
  133 |         sent.projectSaves.push(body);
  134 |         const finishing = body.status === "completed";
  135 |         projects[index] = { ...projects[index], ...withFabric(body), ...(finishing ? { stage: "finish", completedAt: "2026-10-27" } : {}) };
  136 |       }
  137 |       return route.fulfill({ json: projects[index] });
  138 |     }
  139 |     if (itemMatchPatch(pathname) && request.method() === "PATCH") {
  140 |       sent.fabricUpdates.push({ id: itemMatchPatch(pathname), ...(request.postDataJSON() as object) });
  141 |       return route.fulfill({ json: stash.find((entry) => entry.id === itemMatchPatch(pathname)) });
  142 |     }
  143 |     if (pathname === "/api/sewing-tools") return route.fulfill({ json: tools });
  144 |     if (pathname === "/api/dashboard") {
  145 |       return route.fulfill({ json: { totalProjects: 0, activeProjects: 0, completedProjects: 0, recentProjects: [], recentProgress: [], mostUsedYarnBrands: [], mostUsedYarnBrandProjects: 0, averageDaysToFinish: null, charts: { projectsByStatus: [], completedPerMonth: [], completedWithoutDate: 0, progressPerWeek: [] } } });
  146 |     }
  147 |     return route.fulfill({ json: [] });
  148 |   });
  149 | }
  150 | 
  151 | test("shows the Sewing room with its own look, switcher and fabric swatches", async ({ page }) => {
  152 |   await page.setViewportSize({ width: 1280, height: 860 });
  153 |   await mockApi(page, { yarn: true, sewing: true, needsChoice: false }, newSent());
  154 |   await page.goto("/sewing/fabric");
  155 |   await expect(page.getByTestId("link-fabric")).toHaveClass(/selected/);
  156 |   await expect(page.locator(".portal-shell")).toHaveClass(/home-sewing/);
  157 |   await expect(page.getByTestId("link-home-sewing")).toHaveClass(/selected/);
  158 |   await expect(page.getByText("3 fabrics")).toBeVisible();
  159 |   const card = page.getByTestId("card-fabric-bbbbbbbb-0000-4000-8000-000000000001");
  160 |   await expect(card).toContainText("Cotton, floral");
> 161 |   await expect(card).toContainText("Woven · Liberty");
      |                      ^ Error: expect(locator).toContainText(expected) failed
  162 |   await expect(card).toContainText("2.5 m · 145 cm wide");
  163 |   await expect(page.getByTestId("card-fabric-bbbbbbbb-0000-4000-8000-000000000002")).toContainText("1.5 yd · 60 in wide");
  164 |   if (shots) await page.screenshot({ path: `${shots}/fabric-stash-web.png` });
  165 | 
  166 |   await page.getByTestId("select-fabric-print-filter").selectOption("stripe");
  167 |   await expect(page.getByText("1 fabric", { exact: true })).toBeVisible();
  168 | 
  169 |   await page.getByTestId("link-home-yarn").click();
  170 |   await expect(page).toHaveURL(/\/dashboard$/);
  171 |   await expect(page.locator(".portal-shell")).toHaveClass(/home-yarn/);
  172 |   await expect(page.getByTestId("link-fabric")).toHaveCount(0);
  173 | });
  174 | 
  175 | test("adds a fabric with a print close-up and an extra photo", async ({ page }) => {
  176 |   await page.setViewportSize({ width: 1280, height: 1320 });
  177 |   const sent = newSent();
  178 |   await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, sent);
  179 |   await page.goto("/sewing/fabric/new");
  180 |   await expect(page.getByTestId("link-home-yarn")).toHaveCount(0);
  181 |   await page.getByTestId("button-save-fabric").click();
  182 |   await expect(page.getByText("Add a photo of the print.")).toBeVisible();
  183 |   await expect(page.getByText("Choose the fabric type.")).toBeVisible();
  184 | 
  185 |   await page.getByTestId("input-fabric-photo-main").setInputFiles({ name: "print.png", mimeType: "image/png", buffer: photo });
  186 |   await page.getByTestId("input-fabric-photo-more").setInputFiles({ name: "drape.png", mimeType: "image/png", buffer: photo });
  187 |   await page.getByTestId("select-fabric-type").click();
  188 |   const typeWheel = page.getByTestId("select-fabric-type-wheel");
  189 |   await expect(typeWheel.getByRole("option")).toHaveCount(22);
  190 |   await expect(typeWheel.getByRole("option").first()).toHaveText("Blend");
  191 |   await expect(typeWheel.getByRole("option").last()).toHaveText("Other");
  192 |   await typeWheel.getByRole("option", { name: "Linen" }).click();
  193 |   await page.getByTestId("select-fabric-type-done").click();
  194 |   await expect(page.getByTestId("select-fabric-type")).toHaveText("Linen");
  195 |   await page.getByTestId("button-construction-woven").click();
  196 |   await page.getByTestId("select-fabric-print").click();
  197 |   await expect(page.getByTestId("select-fabric-print-wheel").getByRole("option")).toHaveText(["Abstract", "Animal", "Ankara (wax print)", "Batik", "Botanical", "Camo", "Check or plaid", "Chevron", "Damask", "Dots", "Floral", "Geometric", "Houndstooth", "Ikat", "Novelty", "Ombré", "Paisley", "Solid", "Stripe", "Tie-dye", "Toile", "Other"]);
  198 |   await page.getByTestId("select-fabric-print-wheel").getByRole("option", { name: "Check or plaid" }).click();
  199 |   if (shots) await page.screenshot({ path: `${shots}/fabric-print-wheel-web.png` });
  200 |   await page.getByTestId("select-fabric-print-done").click();
  201 |   await expect(page.getByTestId("select-fabric-print")).toHaveText("Check or plaid");
  202 |   await page.getByTestId("button-unit-yards").click();
  203 |   await expect(page.locator(".input-with-unit i").first()).toHaveText("yd");
  204 |   await page.getByTestId("input-fabric-amount").fill("2.75");
  205 |   await page.getByTestId("input-fabric-width").fill("54");
  206 |   await page.getByTestId("button-general-color-green").click();
  207 |   await page.getByTestId("button-prewashed-yes").click();
  208 |   await expect(page.getByTestId("button-prewashed-yes")).toHaveAttribute("aria-checked", "true");
  209 |   await page.getByTestId("input-fabric-notes").fill("For a shirt");
  210 |   if (shots) await page.screenshot({ path: `${shots}/fabric-form-web.png` });
  211 |   await page.getByTestId("button-save-fabric").click();
  212 | 
  213 |   await expect(page).toHaveURL(/\/sewing\/fabric$/);
  214 |   expect(sent.uploads).toBe(2);
  215 |   expect(sent.create).toMatchObject({
  216 |     fabricType: "linen", construction: "woven", print: "check", generalColor: "green", unit: "yards",
  217 |     amount: 2.75, amountLeft: null, width: 54, preWashed: true, notes: "For a shirt",
  218 |     photoPaths: ["/objects/fabric/user/bbbbbbbb-0000-4000-8000-0000000000f1", "/objects/fabric/user/bbbbbbbb-0000-4000-8000-0000000000f2"],
  219 |   });
  220 | });
  221 | 
  222 | test("turns sewing on from Settings in the profile menu, keeping one craft on", async ({ page }) => {
  223 |   const sent = newSent();
  224 |   await mockApi(page, { yarn: true, sewing: false, needsChoice: false }, sent);
  225 |   await page.goto("/dashboard");
  226 |   await expect(page.getByTestId("link-home-sewing")).toHaveCount(0);
  227 |   await page.getByTestId("button-profile-menu").click();
  228 |   await expect(page.getByText("My crafts")).toBeVisible();
  229 |   await expect(page.getByTestId("switch-craft-yarn")).toBeDisabled();
  230 |   if (shots) await page.screenshot({ path: `${shots}/settings-menu-web.png`, clip: { x: 0, y: 400, width: 260, height: 320 } });
  231 |   await page.getByTestId("switch-craft-sewing").click();
  232 |   await expect(page.getByTestId("switch-craft-sewing")).toHaveAttribute("aria-checked", "true");
  233 |   expect(sent.crafts).toEqual([{ yarn: true, sewing: true }]);
  234 |   await expect(page.getByTestId("link-home-sewing")).toBeVisible();
  235 |   await expect(page.getByTestId("switch-craft-yarn")).toBeEnabled();
  236 | });
  237 | 
  238 | test("sends a yarn page to the Sewing room when yarn is off", async ({ page }) => {
  239 |   await mockApi(page, { yarn: false, sewing: true, needsChoice: false }, newSent());
  240 |   await page.goto("/stash");
  241 |   await expect(page).toHaveURL(/\/sewing$/);
  242 | });
  243 | 
  244 | test("asks a new maker what they make", async ({ page }) => {
  245 |   const sent = newSent();
  246 |   await mockApi(page, { yarn: true, sewing: false, needsChoice: true }, sent);
  247 |   await page.goto("/dashboard");
  248 |   await expect(page.getByRole("heading", { name: "What do you make?" })).toBeVisible();
  249 |   if (shots) await page.screenshot({ path: `${shots}/craft-choice-web.png` });
  250 |   await page.getByTestId("button-craft-choice-sewing").click();
  251 |   await expect(page).toHaveURL(/\/sewing$/);
  252 |   expect(sent.crafts).toEqual([{ yarn: false, sewing: true }]);
  253 | });
  254 | 
  255 | test("shows the Sewing room Overview with stages and recent projects", async ({ page }) => {
  256 |   await page.setViewportSize({ width: 1280, height: 1000 });
  257 |   await mockApi(page, { yarn: true, sewing: true, needsChoice: false }, newSent());
  258 |   await page.goto("/sewing");
  259 |   await expect(page.getByTestId("link-sewing-overview")).toHaveClass(/selected/);
  260 |   await expect(page.getByTestId("link-sewing-stat-in-progress")).toContainText("1");
  261 |   await expect(page.getByTestId("text-fabric-length")).toHaveText("7.37 m in your stash");
```