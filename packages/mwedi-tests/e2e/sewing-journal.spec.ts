import { expect, test, type Page } from "@playwright/test";

const shots = process.env.SEWING_SCREENSHOTS;
const projectId = "aaaaaaaa-2222-4000-8000-000000000001";
const cutNote = { id: "11111111-aaaa-4111-8111-111111111111", notes: "Cut all the pieces and marked the darts.", createdAt: "2026-10-24T18:00:00.000Z", updatedAt: "2026-10-24T18:00:00.000Z" };
const fitNote = { id: "22222222-aaaa-4222-8222-222222222222", notes: "First fitting: the waist needs taking in 1 cm.", createdAt: "2026-10-26T18:00:00.000Z", updatedAt: "2026-10-26T18:00:00.000Z" };

type Call = { method: string; path: string; body?: unknown };

async function mockApi(page: Page, calls: Call[]) {
  let entries = [{ ...fitNote }, { ...cutNote }];
  const project = () => ({
    id: projectId, title: "Wrap dress", status: "in_progress", stage: "fit", patternName: null, patternDesigner: null,
    sizeMade: null, fitChanges: null, needleType: null, needleSize: null, threadColor: null, notes: null, completedAt: null,
    fabrics: [], tools: [], entries, createdAt: "2026-10-21T12:00:00.000Z", updatedAt: "2026-10-22T12:00:00.000Z",
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/me/crafts") return route.fulfill({ json: { yarn: false, sewing: true, needsChoice: false } });
    if (pathname === `/api/sewing-projects/${projectId}`) return route.fulfill({ json: project() });
    if (pathname === `/api/sewing-projects/${projectId}/entries` && request.method() === "POST") {
      const body = request.postDataJSON() as { notes: string };
      calls.push({ method: "POST", path: pathname, body });
      const added = { id: "33333333-aaaa-4333-8333-333333333333", notes: body.notes, createdAt: "2026-10-28T18:00:00.000Z", updatedAt: "2026-10-28T18:00:00.000Z" };
      entries = [added, ...entries];
      return route.fulfill({ status: 201, json: added });
    }
    const entry = entries.find(({ id }) => pathname === `/api/sewing-projects/${projectId}/entries/${id}`);
    if (entry && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.push({ method: "PATCH", path: pathname, body });
      Object.assign(entry, body);
      return route.fulfill({ json: entry });
    }
    if (entry && request.method() === "DELETE") {
      calls.push({ method: "DELETE", path: pathname });
      entries = entries.filter(({ id }) => id !== entry.id);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: [] });
  });
}

test("adds, edits and deletes dated notes on a sewing project", async ({ page }) => {
  const calls: Call[] = [];
  await mockApi(page, calls);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/sewing/projects/${projectId}`);

  await expect(page.getByTestId(`entry-sewing-note-${fitNote.id}`)).toContainText("Monday, October 26");
  await page.getByTestId("button-add-sewing-note").click();
  await page.getByTestId("input-sewing-note").fill("Took in the waist and sewed the side seams.");
  await page.getByTestId("button-save-sewing-note").click();
  await expect.poll(() => calls).toEqual([{ method: "POST", path: `/api/sewing-projects/${projectId}/entries`, body: { notes: "Took in the waist and sewed the side seams." } }]);
  await expect(page.getByTestId("input-sewing-note")).toHaveCount(0);
  await expect(page.locator(".sewing-journal .timeline-entry").first()).toContainText("Took in the waist");

  await page.getByTestId(`button-note-menu-${cutNote.id}`).click();
  await page.getByTestId(`button-edit-note-${cutNote.id}`).click();
  await page.getByTestId("input-edit-note").fill("Cut all the pieces, marked the darts and the pleats.");
  if (shots) await page.locator(".sewing-journal").screenshot({ path: `${shots}/sewing-journal-edit-web.png` });
  await page.getByTestId("button-save-edit-note").click();
  await expect.poll(() => calls.at(-1)).toEqual({ method: "PATCH", path: `/api/sewing-projects/${projectId}/entries/${cutNote.id}`, body: { notes: "Cut all the pieces, marked the darts and the pleats." } });
  await expect(page.getByTestId(`entry-sewing-note-${cutNote.id}`)).toContainText("and the pleats");

  await page.getByTestId(`button-note-menu-${cutNote.id}`).click();
  await page.getByTestId(`button-delete-note-${cutNote.id}`).click();
  await page.getByTestId(`button-confirm-delete-note-${cutNote.id}`).click();
  await expect.poll(() => calls.at(-1)).toEqual({ method: "DELETE", path: `/api/sewing-projects/${projectId}/entries/${cutNote.id}` });
  await expect(page.getByTestId(`entry-sewing-note-${cutNote.id}`)).toHaveCount(0);
  if (shots) await page.locator(".sewing-journal").screenshot({ path: `${shots}/sewing-journal-web.png` });
});

test("opening another sewing note saves and closes the one being edited", async ({ page }) => {
  const calls: Call[] = [];
  await mockApi(page, calls);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/sewing/projects/${projectId}`);

  await page.getByTestId(`button-note-menu-${fitNote.id}`).click();
  await page.getByTestId(`button-edit-note-${fitNote.id}`).click();
  await page.getByTestId("input-edit-note").fill("First fitting: take in the waist 1.5 cm.");
  await page.getByTestId("button-add-sewing-note").click();

  await expect.poll(() => calls).toEqual([{ method: "PATCH", path: `/api/sewing-projects/${projectId}/entries/${fitNote.id}`, body: { notes: "First fitting: take in the waist 1.5 cm." } }]);
  await expect(page.getByTestId("signpost")).toContainText("Changes saved");
  await expect(page.getByTestId("input-sewing-note")).toBeVisible();
  await expect(page.getByTestId("input-edit-note")).toHaveCount(0);
  if (shots) await page.screenshot({ path: `${shots}/note-changes-saved-phone-web.png` });
});
