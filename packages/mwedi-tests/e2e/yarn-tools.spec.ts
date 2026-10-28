import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const photo = readFileSync(fileURLToPath(new URL("../fixtures/yarn-photo.png", import.meta.url)));
const shots = process.env.YARN_TOOLS_SCREENSHOTS;

// A drawn hook stands in for a tool photo.
const hookPicture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#EEF2F9"/><path d="M20 66 L58 18 q4 -5 8 -1" fill="none" stroke="#5A7684" stroke-width="6" stroke-linecap="round"/></svg>`;

const hook40 = "4.0 mm (US G-6, UK/Canada 8)";
const hook55 = "5.5 mm (US I-9, UK/Canada 5)";
const needle45 = "4.5 mm (US 7, UK/Canada 7)";

function tool(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, section: "hooks", size: hook55, needleType: null, cableLength: null, material: "aluminium", notionType: null, name: null,
    quantity: null, brand: null, notes: null, hasPhoto: false, createdAt: "2026-10-28T12:00:00.000Z", updatedAt: "2026-10-28T12:00:00.000Z",
    ...overrides,
  };
}

type Sent = { saves: unknown[]; uploads: number; deleted: string[] };

async function mockApi(page: Page, sent: Sent) {
  const tools = [
    tool("eeeeeeee-0000-4000-8000-000000000001"),
    tool("eeeeeeee-0000-4000-8000-000000000002", { size: hook40, material: "bamboo", quantity: 2, brand: "Clover", hasPhoto: true }),
    tool("eeeeeeee-0000-4000-8000-000000000003", { section: "needles", size: needle45, needleType: "circular", cableLength: "80 cm (32 in)", material: "wood" }),
    tool("eeeeeeee-0000-4000-8000-000000000004", { section: "notions", size: null, material: null, notionType: "stitch_markers", name: "Locking markers", quantity: 40 }),
    tool("eeeeeeee-0000-4000-8000-000000000005", { section: "notions", size: null, material: null, notionType: "scissors" }),
  ];
  await page.route("**/storage.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    if (pathname === "/api/me/crafts") return route.fulfill({ json: { yarn: true, sewing: false, needsChoice: false } });
    if (pathname === "/api/yarn-tools/photo-upload") {
      sent.uploads += 1;
      return route.fulfill({ json: { uploadURL: "https://storage.test/upload", photoPath: "/objects/yarn-tools/user/eeeeeeee-0000-4000-8000-0000000000f1" } });
    }
    if (pathname === "/api/yarn-tools" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      sent.saves.push(body);
      const { photoPath, ...rest } = body;
      const created = tool("eeeeeeee-0000-4000-8000-000000000009", { ...rest, hasPhoto: Boolean(photoPath) });
      tools.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (pathname === "/api/yarn-tools") {
      const search = url.searchParams.get("search")?.toLowerCase();
      return route.fulfill({ json: tools.filter((item) => !search || [item.size, item.name, item.brand].some((value) => String(value ?? "").toLowerCase().includes(search))) });
    }
    if (/^\/api\/yarn-tools\/[^/]+\/photo$/.test(pathname)) return route.fulfill({ contentType: "image/svg+xml", body: hookPicture });
    const match = pathname.match(/^\/api\/yarn-tools\/([^/]+)$/);
    if (match) {
      const index = tools.findIndex((item) => item.id === match[1]);
      if (request.method() === "DELETE") {
        sent.deleted.push(match[1]!);
        tools.splice(index, 1);
        return route.fulfill({ status: 204, body: "" });
      }
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as Record<string, unknown>;
        sent.saves.push(body);
        const { photoPath, ...rest } = body;
        tools[index] = { ...tools[index]!, ...rest, ...(photoPath !== undefined ? { hasPhoto: Boolean(photoPath) } : {}) };
      }
      return route.fulfill({ json: tools[index] });
    }
    return route.fulfill({ json: [] });
  });
}

test("lists hooks, needles and notions in the Yarn studio", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page, { saves: [], uploads: 0, deleted: [] });
  await page.goto("/tools");
  await expect(page.getByTestId("link-yarn-tools")).toHaveClass(/selected/);
  await expect(page.getByTestId("link-tools")).toHaveCount(0);
  await expect(page.getByTestId("section-yarn-tools-hooks")).toContainText("Hooks 2");
  await expect(page.getByTestId("section-yarn-tools-needles")).toContainText("Needles 1");
  await expect(page.getByTestId("section-yarn-tools-notions")).toContainText("Notions 2");
  // Smallest hook first.
  await expect(page.getByTestId("section-yarn-tools-hooks").locator(".tool-row b")).toHaveText([hook40, hook55]);
  await expect(page.getByTestId("card-yarn-tool-eeeeeeee-0000-4000-8000-000000000002")).toContainText("Bamboo · Clover");
  await expect(page.getByTestId("card-yarn-tool-eeeeeeee-0000-4000-8000-000000000002")).toContainText("× 2");
  await expect(page.getByTestId("card-yarn-tool-eeeeeeee-0000-4000-8000-000000000003")).toContainText("Circular, 80 cm (32 in) · Wood");
  await expect(page.getByTestId("section-yarn-tools-notions").locator(".tool-row b")).toHaveText(["Locking markers", "Scissors"]);
  if (shots) await page.screenshot({ path: `${shots}/yarn-tools-web.png`, fullPage: true });

  await page.getByTestId("button-yarn-tool-section-needles").click();
  await expect(page).toHaveURL(/\/tools\?section=needles$/);
  await expect(page.getByTestId("section-yarn-tools-hooks")).toHaveCount(0);
  await page.getByTestId("button-yarn-tool-section-all").click();
  await page.getByTestId("input-search-yarn-tools").fill("G-6");
  await expect(page.getByTestId("section-yarn-tools-hooks")).toContainText("Hooks 1");
  await expect(page.getByTestId("section-yarn-tools-notions")).toHaveCount(0);
});

test("adds needles with a cable and a photo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const sent: Sent = { saves: [], uploads: 0, deleted: [] };
  await mockApi(page, sent);
  await page.goto("/tools/new?section=needles");
  await page.getByTestId("button-save-yarn-tool").click();
  await expect(page.getByText("Choose a size.")).toBeVisible();

  await page.getByTestId("select-yarn-tool-size").click();
  await page.getByTestId("select-yarn-tool-size-wheel").getByRole("option", { name: needle45 }).click();
  await page.getByTestId("select-yarn-tool-size-done").click();
  await expect(page.getByTestId("select-yarn-tool-cable")).toHaveCount(0);
  await page.getByTestId("select-yarn-tool-needle-type").click();
  await page.getByTestId("select-yarn-tool-needle-type-wheel").getByRole("option", { name: "Interchangeable" }).click();
  await page.getByTestId("select-yarn-tool-needle-type-done").click();
  await page.getByTestId("select-yarn-tool-cable").click();
  await page.getByTestId("select-yarn-tool-cable-wheel").getByRole("option", { name: "60 cm (24 in)" }).click();
  await page.getByTestId("select-yarn-tool-cable-done").click();
  await page.getByTestId("select-yarn-tool-material").click();
  await page.getByTestId("select-yarn-tool-material-wheel").getByRole("option", { name: "Bamboo" }).click();
  await page.getByTestId("select-yarn-tool-material-done").click();
  await page.getByTestId("input-yarn-tool-quantity").fill("1");
  await page.getByTestId("input-yarn-tool-brand").fill("ChiaoGoo");
  await page.getByTestId("input-yarn-tool-photo").setInputFiles({ name: "needles.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByAltText("Tool photo")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/yarn-tool-form-web.png`, fullPage: true });
  await page.getByTestId("button-save-yarn-tool").click();

  await expect(page).toHaveURL(/\/tools\?section=needles$/);
  expect(sent.uploads).toBe(1);
  expect(sent.saves[0]).toEqual({
    section: "needles", size: needle45, needleType: "interchangeable", cableLength: "60 cm (24 in)", material: "bamboo", notionType: null,
    name: null, quantity: 1, brand: "ChiaoGoo", notes: null, photoPath: "/objects/yarn-tools/user/eeeeeeee-0000-4000-8000-0000000000f1",
  });
});

test("adds a notion by type", async ({ page }) => {
  const sent: Sent = { saves: [], uploads: 0, deleted: [] };
  await mockApi(page, sent);
  await page.goto("/tools/new?section=notions");
  await expect(page.getByTestId("select-yarn-tool-size")).toHaveCount(0);
  await expect(page.getByTestId("select-yarn-tool-material")).toHaveCount(0);
  await page.getByTestId("button-save-yarn-tool").click();
  await expect(page.getByText("Choose what kind of notion this is.")).toBeVisible();
  await page.getByTestId("select-yarn-notion-type").click();
  await expect(page.getByTestId("select-yarn-notion-type-wheel").getByRole("option")).toHaveText([
    "Stitch markers", "Tapestry needles", "Row counter", "Cable needles", "Scissors", "Measuring tape", "Blocking mats", "Blocking pins", "Yarn swift", "Ball winder", "Other",
  ]);
  await page.getByTestId("select-yarn-notion-type-wheel").getByRole("option", { name: "Blocking pins" }).click();
  if (shots) await page.screenshot({ path: `${shots}/yarn-notion-type-web.png` });
  await page.getByTestId("select-yarn-notion-type-done").click();
  await page.getByTestId("input-yarn-tool-quantity").fill("100");
  await page.getByTestId("button-save-yarn-tool").click();
  await expect(page).toHaveURL(/\/tools\?section=notions$/);
  expect(sent.saves[0]).toMatchObject({ section: "notions", size: null, notionType: "blocking_pins", quantity: 100, material: null });
  await expect(page.getByTestId("card-yarn-tool-eeeeeeee-0000-4000-8000-000000000009")).toContainText("Blocking pins");
});

test("edits a hook, removes its photo and deletes a tool", async ({ page }) => {
  const sent: Sent = { saves: [], uploads: 0, deleted: [] };
  await mockApi(page, sent);
  await page.goto("/tools/eeeeeeee-0000-4000-8000-000000000002");
  await expect(page.getByTestId("select-yarn-tool-size")).toHaveText(hook40);
  await expect(page.getByTestId("select-yarn-tool-needle-type")).toHaveCount(0);
  await page.getByTestId("button-remove-yarn-tool-photo").click();
  await page.getByTestId("input-yarn-tool-quantity").fill("3");
  await page.getByTestId("button-save-yarn-tool").click();
  await expect(page).toHaveURL(/\/tools\?section=hooks$/);
  expect(sent.saves[0]).toMatchObject({ size: hook40, quantity: 3, photoPath: null });

  await page.goto("/tools/eeeeeeee-0000-4000-8000-000000000005");
  await page.getByTestId("button-delete-yarn-tool").click();
  await page.getByTestId("button-confirm-delete-yarn-tool").click();
  await expect(page).toHaveURL(/\/tools\?section=notions$/);
  expect(sent.deleted).toEqual(["eeeeeeee-0000-4000-8000-000000000005"]);
});
