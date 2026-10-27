import { expect, test, type Page } from "@playwright/test";

const projectId = "journal-notes-e2e";
const newer = { id: "11111111-1111-4111-8111-111111111111", projectId, notes: "Finished the second sleeve. Switched to the 4.5mm hook for the cuff so it pulls in a little.", photoPath: null, completionPercent: 62, progressValue: null, createdAt: "2026-10-26T18:00:00.000Z" };
const older = { id: "22222222-2222-4222-8222-222222222222", projectId, notes: "Joined the front and back panels. Seams are a bit tight on the left side, might redo.", photoPath: null, completionPercent: 48, progressValue: null, createdAt: "2026-10-24T18:00:00.000Z" };

function project(progress: unknown[]) {
  return {
    id: projectId, title: "Granny square cardigan", craft: "crochet", status: "in_progress",
    description: null, patternName: null, patternDesigner: null, designerWebsite: null, designerPageTitle: null,
    yarn: null, yarns: [], tools: null, hookSize: null, secondHookSize: null,
    needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
    startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day",
    completedAt: null, completedAtPrecision: "day", starred: false,
    progressMethod: "estimate", progressTotal: null, progressSections: [],
    completionPercent: 62, counter: 0, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
    progress,
  };
}

async function mockApi(page: Page, calls: { method: string; path: string; body?: unknown }[]) {
  let notes = [{ ...newer }, { ...older }];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const entry = notes.find(({ id }) => pathname === `/api/projects/${projectId}/progress/${id}`);
    if (entry && request.method() === "PATCH") {
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.push({ method: "PATCH", path: pathname, body });
      Object.assign(entry, body);
      return route.fulfill({ json: entry });
    }
    if (entry && request.method() === "DELETE") {
      calls.push({ method: "DELETE", path: pathname });
      notes = notes.filter(({ id }) => id !== entry.id);
      return route.fulfill({ status: 204 });
    }
    if (pathname === `/api/projects/${projectId}`) return route.fulfill({ json: project(notes) });
    return route.fulfill({ json: [] });
  });
}

test("edits a note from its ⋯ bubble, sending only what changed", async ({ page }) => {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  await mockApi(page, calls);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/projects/${projectId}`);

  await page.getByTestId(`button-note-menu-${newer.id}`).click();
  await expect(page.getByTestId(`button-edit-note-${newer.id}`)).toBeVisible();
  if (process.env.JOURNAL_SCREENSHOTS) await page.getByTestId(`entry-progress-${newer.id}`).locator("..").screenshot({ path: `${process.env.JOURNAL_SCREENSHOTS}/web-note-menu.png` });
  await page.getByTestId(`button-edit-note-${newer.id}`).click();

  await page.getByTestId("input-edit-note").fill("Finished both sleeves.");
  if (process.env.JOURNAL_SCREENSHOTS) await page.getByTestId(`entry-progress-${newer.id}`).screenshot({ path: `${process.env.JOURNAL_SCREENSHOTS}/web-edit-note.png` });
  await page.getByTestId("button-save-edit-note").click();
  await expect.poll(() => calls).toEqual([
    { method: "PATCH", path: `/api/projects/${projectId}/progress/${newer.id}`, body: { notes: "Finished both sleeves." } },
  ]);
  await expect(page.getByTestId(`entry-progress-${newer.id}`)).toContainText("Finished both sleeves.");

  await page.getByTestId(`button-note-menu-${newer.id}`).click();
  await page.getByTestId(`button-edit-note-${newer.id}`).click();
  await page.getByTestId("input-progress-percent").fill("70");
  await page.getByTestId("button-save-edit-note").click();
  await expect.poll(() => calls.at(-1)?.body).toEqual({ notes: "Finished both sleeves.", completionPercent: 70 });
});

test("asks before deleting a note", async ({ page }) => {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  await mockApi(page, calls);
  await page.goto(`/projects/${projectId}`);

  await page.getByTestId(`button-note-menu-${older.id}`).click();
  await page.getByTestId(`button-delete-note-${older.id}`).click();
  await expect(page.getByText("Delete this note?")).toBeVisible();
  if (process.env.JOURNAL_SCREENSHOTS) await page.getByTestId(`entry-progress-${older.id}`).screenshot({ path: `${process.env.JOURNAL_SCREENSHOTS}/web-delete-note.png` });
  await page.getByTestId(`button-cancel-delete-note-${older.id}`).click();
  expect(calls).toEqual([]);

  await page.getByTestId(`button-note-menu-${older.id}`).click();
  await page.getByTestId(`button-delete-note-${older.id}`).click();
  await page.getByTestId(`button-confirm-delete-note-${older.id}`).click();
  await expect.poll(() => calls).toEqual([{ method: "DELETE", path: `/api/projects/${projectId}/progress/${older.id}` }]);
  await expect(page.getByTestId(`entry-progress-${older.id}`)).toHaveCount(0);
});
