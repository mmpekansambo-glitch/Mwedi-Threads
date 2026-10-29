// Scenario: Bisi uses only the Sewing room, clicking through the web app
// against the real API and a throwaway database. One story, step by step.
import { expect, test, type Page } from "@playwright/test";
import { photo, printPhotosLookAlike, signInAs } from "./scenarioApi";

async function pickFromWheel(page: Page, testId: string, option: string) {
  await page.getByTestId(testId).click();
  await page.getByTestId(`${testId}-wheel`).getByRole("option", { name: option, exact: true }).click();
  await page.getByTestId(`${testId}-done`).click();
}

async function addFabric(page: Page, type: string, print: string, amount: string) {
  await page.goto("/sewing/fabric/new");
  await page.getByTestId("input-fabric-photo-main").setInputFiles({ name: "print.png", mimeType: "image/png", buffer: photo });
  await pickFromWheel(page, "select-fabric-type", type);
  await pickFromWheel(page, "select-fabric-print", print);
  await page.getByTestId("input-fabric-amount").fill(amount);
  await page.getByTestId("button-save-fabric").click();
}

function idOf(testId: string | null, prefix: string): string {
  return testId!.slice(prefix.length);
}

test("a maker who works in the Sewing room", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await signInAs(page, `browser-sewing-${Date.now()}`);
  let cottonId = "";
  let jerseyId = "";
  let zipId = "";
  let projectUrl = "";

  await test.step("signs up and picks sewing", async () => {
    await page.goto("/dashboard");
    await page.getByTestId("button-craft-choice-sewing").click();
    await expect(page).toHaveURL(/\/sewing$/);
    // Yarn is off, so the Yarn studio isn't offered.
    await expect(page.getByTestId("link-home-yarn")).toHaveCount(0);
  });

  await test.step("adds cotton and jersey to the fabric stash", async () => {
    await addFabric(page, "Cotton", "Floral", "3");
    await expect(page).toHaveURL(/\/sewing\/fabric$/);
    await addFabric(page, "Jersey", "Stripe", "2");
    await expect(page).toHaveURL(/\/sewing\/fabric$/);
    const cards = page.locator('[data-testid^="card-fabric-"]');
    await expect(cards).toHaveCount(2);
    cottonId = idOf(await cards.filter({ hasText: "Cotton" }).getAttribute("data-testid"), "card-fabric-");
    jerseyId = idOf(await cards.filter({ hasText: "Jersey" }).getAttribute("data-testid"), "card-fabric-");
  });

  await test.step("adds a zip to Tools", async () => {
    await page.goto("/sewing/tools/new?section=notions");
    await pickFromWheel(page, "select-tool-type-closures", "Zip");
    await page.getByTestId("input-tool-name").fill("Invisible zip");
    await page.getByTestId("input-tool-quantity").fill("1");
    await page.getByTestId("button-save-tool").click();
    await expect(page).toHaveURL(/\/sewing\/tools/);
    const card = page.locator('[data-testid^="card-tool-"]', { hasText: "Invisible zip" });
    await expect(card).toBeVisible();
    zipId = idOf(await card.getAttribute("data-testid"), "card-tool-");
  });

  await test.step("starts a dress with the cotton, the zip, a needle and thread", async () => {
    await page.goto("/sewing/projects/new");
    await page.getByTestId("input-sewing-title").fill("Summer dress");
    await page.getByTestId("select-sewing-status").selectOption("in_progress");
    await page.getByTestId("button-add-sewing-fabric").click();
    await page.getByTestId(`button-pick-fabric-${cottonId}`).click();
    await page.getByTestId("input-sewing-fabric-used-0").fill("2.5");
    await page.getByTestId("button-add-sewing-tool").click();
    await page.getByTestId(`button-pick-tool-${zipId}`).click();
    await page.getByTestId("row-sewing-needle").click();
    await page.getByTestId("row-sewing-needle-wheel-0").getByRole("option", { name: "Universal" }).click();
    await page.getByTestId("row-sewing-needle-wheel-1").getByRole("option", { name: "80/12" }).click();
    await page.getByTestId("row-sewing-needle-done").click();
    await page.getByTestId("row-sewing-thread").click();
    await page.getByTestId("row-sewing-thread-wheel-0").getByRole("option", { name: "Blue" }).click();
    await page.getByTestId("row-sewing-thread-done").click();
    await page.getByTestId("button-save-sewing-project").click();
    await expect(page.getByRole("heading", { name: "Summer dress" })).toBeVisible();
    projectUrl = new URL(page.url()).pathname;
    await expect(page.getByTestId(`card-project-fabric-${cottonId}`)).toContainText("Uses 2.5 m");
    await expect(page.getByTestId(`card-tool-${zipId}`)).toContainText("Invisible zip");
    await expect(page.getByText("Universal 80/12")).toBeVisible();
  });

  await test.step("writes two notes, and opening the new-note box while editing saves the edit (#84)", async () => {
    const addNote = async (text: string) => {
      await page.getByTestId("button-add-sewing-note").click();
      await page.getByTestId("input-sewing-note").fill(text);
      await page.getByTestId("button-save-sewing-note").click();
      await expect(page.locator('[data-testid^="entry-sewing-note-"]', { hasText: text })).toBeVisible();
    };
    await addNote("Cut all the pieces");
    await addNote("Bodice too short");
    const bodice = idOf(await page.locator('[data-testid^="entry-sewing-note-"]', { hasText: "Bodice" }).getAttribute("data-testid"), "entry-sewing-note-");

    await page.getByTestId(`button-note-menu-${bodice}`).click();
    await page.getByTestId(`button-edit-note-${bodice}`).click();
    await page.getByTestId("input-edit-note").fill("Bodice lengthened 2 cm");
    await page.getByTestId("button-add-sewing-note").click();
    await expect(page.getByTestId("signpost")).toContainText("Changes saved");
    await expect(page.getByTestId("input-edit-note")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId(`entry-sewing-note-${bodice}`)).toContainText("Bodice lengthened 2 cm");
  });

  await test.step("edits the cotton in the stash and the project shows it, not a copy (#83)", async () => {
    await page.goto(`/sewing/fabric/${cottonId}`);
    await pickFromWheel(page, "select-fabric-print", "Stripe");
    await page.getByTestId("button-save-fabric").click();
    await expect(page).toHaveURL(/\/sewing\/fabric$/);
    await page.goto(projectUrl);
    await expect(page.getByTestId(`card-project-fabric-${cottonId}`)).toContainText("Cotton, stripe");
  });

  await test.step("sees the Overview: one in progress, a cut fabric chart and the stash length", async () => {
    await page.goto("/sewing");
    await expect(page.getByTestId("link-sewing-stat-in-progress")).toContainText("1");
    await expect(page.getByTestId("text-fabric-length")).toHaveText("5 m in your stash");
    await expect(page.getByTestId("link-fabric-type-cotton")).toBeVisible();
    await expect(page.getByTestId("link-fabric-type-jersey")).toBeVisible();
  });

  await test.step("finishes the dress and takes the fabric used off the stash (#83)", async () => {
    await page.goto(projectUrl);
    await page.getByTestId("button-finish-sewing-project").click();
    await expect(page.getByTestId("prompt-fabric-left")).toContainText("Cotton, stripe: 3 m left → 0.5 m");
    await page.getByTestId("button-update-stash").click();
    await expect(page.getByTestId("prompt-fabric-left")).toHaveCount(0);
    await expect(page.getByTestId("button-reopen-sewing-project")).toBeVisible();
    await page.goto("/sewing");
    await expect(page.getByTestId("link-sewing-stat-finished")).toContainText("1");
    await expect(page.getByTestId("text-fabric-length")).toHaveText("2.5 m in your stash");
  });

  await test.step("uses up the jersey and moves it to the Archive (#83)", async () => {
    await page.goto(`/sewing/fabric/${jerseyId}`);
    await page.getByTestId("input-fabric-amount-left").fill("0");
    await page.getByTestId("button-save-fabric").click();
    await expect(page.getByTestId(`archive-nudge-${jerseyId}`)).toContainText("All used up.");
    await page.getByTestId("button-move-to-archive").click();
    await expect(page).toHaveURL(/\/sewing\/fabric$/);
    await expect(page.getByTestId(`card-fabric-${jerseyId}`)).toHaveCount(0);
    await page.goto("/sewing");
    await expect(page.getByTestId("text-fabric-length")).toHaveText("0.5 m in your stash");
    await expect(page.getByTestId("link-fabric-type-jersey")).toHaveCount(0);
  });

  await test.step("buys the same jersey again: 'Same fabric?' brings it back (#83)", async () => {
    await printPhotosLookAlike(true);
    await addFabric(page, "Jersey", "Stripe", "4");
    await expect(page.getByTestId("same-fabric-check")).toContainText("Same fabric? This looks like the jersey");
    await page.getByTestId("button-same-fabric").click();
    await expect(page).toHaveURL(/\/sewing\/fabric$/);
    await expect(page.getByTestId("signpost")).toContainText("Welcome back");
    await expect(page.getByTestId(`card-fabric-${jerseyId}`)).toBeVisible();
    await expect(page.locator('[data-testid^="card-fabric-"]')).toHaveCount(2);
  });

  await test.step("uses the zip and archives it from Tools (#83)", async () => {
    await page.goto(`/sewing/tools/${zipId}`);
    await page.getByTestId("input-tool-quantity").fill("0");
    await page.getByTestId("button-save-tool").click();
    await expect(page.getByTestId(`archive-nudge-${zipId}`)).toContainText("All used up.");
    await page.getByTestId("button-move-to-archive").click();
    await expect(page.getByTestId(`card-tool-${zipId}`)).toHaveCount(0);
    // The finished dress still lists the zip it used.
    await page.goto(projectUrl);
    await expect(page.getByTestId(`card-tool-${zipId}`)).toContainText("Invisible zip");
  });
});
