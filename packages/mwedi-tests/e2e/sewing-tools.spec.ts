import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const photo = readFileSync(fileURLToPath(new URL("../fixtures/yarn-photo.png", import.meta.url)));
const shots = process.env.SEWING_SCREENSHOTS;

// A drawn spool stands in for a tool photo.
const spool = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#EEF3F0"/><rect x="22" y="14" width="36" height="8" rx="2" fill="#B08A5A"/><rect x="22" y="58" width="36" height="8" rx="2" fill="#B08A5A"/><rect x="26" y="22" width="28" height="36" fill="#2F4F8F"/>${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="26" y="${24 + i * 6}" width="28" height="2" fill="#5A7AB8"/>`).join("")}</svg>`;

function tool(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, section: "notions", category: "zip", name: "Invisible zip", quantity: 3, size: "22 cm", color: "Navy", brand: null,
    notes: null, hasPhoto: false, createdAt: "2026-10-27T12:00:00.000Z", updatedAt: "2026-10-27T12:00:00.000Z",
    ...overrides,
  };
}

type Sent = { saves: unknown[]; uploads: number; deleted: string[] };

async function mockApi(page: Page, sent: Sent) {
  const tools = [
    tool("dddddddd-0000-4000-8000-000000000001"),
    tool("dddddddd-0000-4000-8000-000000000002", { category: "thread", name: "All-purpose thread", quantity: 4, size: null, color: "Cream", brand: "Maker Example", hasPhoto: true }),
    tool("dddddddd-0000-4000-8000-000000000003", { category: "interfacing", name: "Fusible interfacing", quantity: null, size: "1 m", color: "White" }),
    tool("dddddddd-0000-4000-8000-000000000004", { section: "kit", category: "machine", name: "Sewing machine", quantity: null, size: null, color: null, brand: "Maker Example" }),
    tool("dddddddd-0000-4000-8000-000000000005", { section: "kit", category: "needle", name: "Jersey needles", quantity: 5, size: "90/14", color: null }),
    tool("dddddddd-0000-4000-8000-000000000006", { section: "kit", category: "scissors", name: "Fabric shears", quantity: null, size: "25 cm", color: null }),
  ];
  await page.route("**/storage.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    if (pathname === "/api/me/crafts") return route.fulfill({ json: { yarn: false, sewing: true, needsChoice: false } });
    if (pathname === "/api/sewing-tools/photo-upload") {
      sent.uploads += 1;
      return route.fulfill({ json: { uploadURL: "https://storage.test/upload", photoPath: "/objects/sewing-tools/user/dddddddd-0000-4000-8000-0000000000f1" } });
    }
    if (pathname === "/api/sewing-tools" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      sent.saves.push(body);
      const { photoPath, ...rest } = body;
      const created = tool("dddddddd-0000-4000-8000-000000000009", { ...rest, hasPhoto: Boolean(photoPath) });
      tools.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (pathname === "/api/sewing-tools") {
      const search = url.searchParams.get("search")?.toLowerCase();
      return route.fulfill({ json: tools.filter((item) => !search || [item.name, item.size, item.color, item.brand].some((value) => String(value ?? "").toLowerCase().includes(search))) });
    }
    if (/^\/api\/sewing-tools\/[^/]+\/photo$/.test(pathname)) return route.fulfill({ contentType: "image/svg+xml", body: spool });
    const match = pathname.match(/^\/api\/sewing-tools\/([^/]+)$/);
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

test("lists notions and kit in their own sections", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockApi(page, { saves: [], uploads: 0, deleted: [] });
  await page.goto("/sewing/tools");
  await expect(page.getByTestId("link-tools")).toHaveClass(/selected/);
  await expect(page.getByTestId("section-tools-notions")).toContainText("Notions 3");
  await expect(page.getByTestId("section-tools-kit")).toContainText("Kit 3");
  await expect(page.getByTestId("card-tool-dddddddd-0000-4000-8000-000000000001")).toContainText("Zip · 22 cm · Navy");
  await expect(page.getByTestId("card-tool-dddddddd-0000-4000-8000-000000000001")).toContainText("× 3");
  if (shots) await page.screenshot({ path: `${shots}/sewing-tools-web.png`, fullPage: true });

  await page.getByTestId("button-tool-section-kit").click();
  await expect(page).toHaveURL(/\/sewing\/tools\?section=kit$/);
  await expect(page.getByTestId("section-tools-notions")).toHaveCount(0);
  await page.getByTestId("input-search-tools").fill("90/14");
  await expect(page.getByTestId("section-tools-kit")).toContainText("Kit 1");
});

test("adds a notion with a photo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1100 });
  const sent: Sent = { saves: [], uploads: 0, deleted: [] };
  await mockApi(page, sent);
  await page.goto("/sewing/tools/new?section=notions");
  await page.getByTestId("button-save-tool").click();
  await expect(page.getByText("Choose what kind of tool this is.")).toBeVisible();
  await expect(page.getByText("Give it a name.")).toBeVisible();

  await expect(page.locator('#tool-category optgroup[label="Closures"] option')).toContainText(["Zip", "Buttons", "Snaps", "Hooks and eyes"]);
  await expect(page.locator('#tool-category optgroup[label="Hardware"] option')).toHaveCount(4);
  await page.getByTestId("select-tool-category").selectOption("button");
  await page.getByTestId("input-tool-name").fill("Shell buttons");
  await page.getByTestId("input-tool-quantity").fill("6");
  await page.getByTestId("input-tool-size").fill("15 mm");
  await page.getByTestId("input-tool-color").fill("Ivory");
  await page.getByTestId("input-tool-photo").setInputFiles({ name: "buttons.png", mimeType: "image/png", buffer: photo });
  await expect(page.getByAltText("Tool photo")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/sewing-tool-form-web.png`, fullPage: true });
  await page.getByTestId("button-save-tool").click();

  await expect(page).toHaveURL(/\/sewing\/tools\?section=notions$/);
  expect(sent.uploads).toBe(1);
  expect(sent.saves[0]).toEqual({
    section: "notions", category: "button", name: "Shell buttons", quantity: 6, size: "15 mm", color: "Ivory", brand: null, notes: null,
    photoPath: "/objects/sewing-tools/user/dddddddd-0000-4000-8000-0000000000f1",
  });
  await expect(page.getByTestId("card-tool-dddddddd-0000-4000-8000-000000000009")).toContainText("Buttons · 15 mm · Ivory");
});

test("edits kit, removes its photo and deletes it", async ({ page }) => {
  const sent: Sent = { saves: [], uploads: 0, deleted: [] };
  await mockApi(page, sent);
  await page.goto("/sewing/tools/dddddddd-0000-4000-8000-000000000002");
  await expect(page.getByTestId("input-tool-name")).toHaveValue("All-purpose thread");
  await page.getByTestId("button-remove-tool-photo").click();
  await page.getByTestId("input-tool-quantity").fill("2");
  await page.getByTestId("button-save-tool").click();
  await expect(page).toHaveURL(/\/sewing\/tools\?section=notions$/);
  expect(sent.saves[0]).toMatchObject({ quantity: 2, photoPath: null });

  await page.goto("/sewing/tools/dddddddd-0000-4000-8000-000000000004");
  await expect(page.getByTestId("input-tool-color")).toHaveCount(0);
  await page.getByTestId("input-tool-size").fill("12 mm");
  await page.getByTestId("button-save-tool").click();
  await expect(page).toHaveURL(/\/sewing\/tools\?section=kit$/);
  expect(sent.saves[1]).not.toHaveProperty("photoPath");

  await page.goto("/sewing/tools/dddddddd-0000-4000-8000-000000000006");
  await page.getByTestId("button-delete-tool").click();
  await page.getByTestId("button-confirm-delete-tool").click();
  await expect(page).toHaveURL(/\/sewing\/tools\?section=kit$/);
  expect(sent.deleted).toEqual(["dddddddd-0000-4000-8000-000000000006"]);
});
