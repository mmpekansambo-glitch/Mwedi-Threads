// Scenario: Amara uses only the Yarn studio, clicking through the web app
// against the real API and a throwaway database. One story, step by step.
import { expect, test } from "@playwright/test";
import { photo, signInAs } from "./scenarioApi";

test("a maker who works in the Yarn studio", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await signInAs(page, `browser-yarn-${Date.now()}`);
  let fishermanId = "";
  let projectUrl = "";

  await test.step("signs up and picks yarn", async () => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "What do you make?" })).toBeVisible();
    await page.getByTestId("button-craft-choice-yarn").click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await test.step("adds two yarns to the stash", async () => {
    const addYarn = async (brand: string, subBrand: string, color: string, skeins: string) => {
      await page.goto("/stash/new");
      await page.getByTestId("input-stash-photo").setInputFiles({ name: "skein.png", mimeType: "image/png", buffer: photo });
      await page.getByTestId("input-stash-brand").fill(brand);
      await page.getByTestId("input-stash-sub-brand").fill(subBrand);
      await page.getByTestId("input-stash-color").fill(color);
      await page.getByTestId("input-skeins-purchased").fill(skeins);
      await page.getByTestId("button-save-yarn").click();
      await expect(page).toHaveURL(/\/stash$/);
    };
    await addYarn("lion brand", "Wool-Ease", "Fisherman", "4");
    await addYarn("lion brand", "Wool-Ease", "Cranberry", "2");
    await expect(page.getByText("2 yarns")).toBeVisible();
    const fisherman = page.locator('[data-testid^="card-stash-yarn-"]', { hasText: "Fisherman" });
    fishermanId = (await fisherman.getAttribute("data-testid"))!.replace("card-stash-yarn-", "");
  });

  await test.step("fixes the brand's capitals, renames the other yarn too, and both stick (#79)", async () => {
    await page.getByTestId(`card-stash-yarn-${fishermanId}`).click();
    await page.getByTestId("input-stash-brand").fill("Lion Brand");
    await page.getByTestId("button-save-yarn").click();
    await expect(page.getByTestId("rename-offer")).toContainText("Rename lion brand to Lion Brand on it too?");
    await page.getByTestId("button-rename-others").click();
    await expect(page).toHaveURL(/\/stash$/);
    // Straight away, and still after a reload from the server.
    await expect(page.locator('[data-testid^="card-stash-yarn-"]', { hasText: /lion brand/ })).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-testid^="card-stash-yarn-"]', { hasText: /Lion Brand Wool-Ease/ })).toHaveCount(2);
  });

  await test.step("adds a hook to Tools", async () => {
    await page.goto("/tools/new?section=hooks");
    await page.getByTestId("select-yarn-tool-size").click();
    await page.getByTestId("select-yarn-tool-size-wheel").getByRole("option", { name: "5.0 mm (US H-8, UK/Canada 6)" }).click();
    await page.getByTestId("select-yarn-tool-size-done").click();
    await page.getByTestId("button-save-yarn-tool").click();
    await expect(page).toHaveURL(/\/tools(\?|$)/);
    await expect(page.getByTestId("section-yarn-tools-hooks")).toContainText("Hooks 1");
  });

  await test.step("starts a crochet throw with stash yarn", async () => {
    await page.goto("/projects/new");
    await page.getByTestId("input-project-title").fill("Cabled throw");
    await page.getByTestId("select-project-craft").selectOption("crochet");
    await page.getByTestId("select-project-status").selectOption("in_progress");
    await page.getByTestId("project-yarn-0-stash").selectOption(fishermanId);
    await page.getByTestId("project-yarn-0-skeins").fill("3");
    await page.getByTestId("button-save-project").click();
    await expect(page.getByRole("heading", { name: "Cabled throw" })).toBeVisible();
    projectUrl = new URL(page.url()).pathname;
    await expect(page.getByTestId("list-project-yarns")).toContainText("Lion Brand Wool-Ease · Fisherman");
  });

  await test.step("writes two notes, and opening one while editing the other saves it (#84)", async () => {
    const addNote = async (text: string) => {
      await page.getByTestId("button-add-progress").click();
      await page.getByTestId("input-progress-notes").fill(text);
      await page.getByTestId("button-save-progress").click();
      await expect(page.locator('[data-testid^="entry-progress-"]', { hasText: text })).toBeVisible();
    };
    await addNote("First cable panel done");
    await addNote("Second panel");
    const entryId = async (text: string) =>
      (await page.locator('[data-testid^="entry-progress-"]', { hasText: text }).getAttribute("data-testid"))!.replace("entry-progress-", "");
    const first = await entryId("First cable panel done");
    const second = await entryId("Second panel");

    await page.getByTestId(`button-note-menu-${second}`).click();
    await page.getByTestId(`button-edit-note-${second}`).click();
    await page.getByTestId("input-edit-note").fill("Second panel, cables crossed right");
    await page.getByTestId(`button-note-menu-${first}`).click();
    await page.getByTestId(`button-edit-note-${first}`).click();
    await expect(page.getByTestId("signpost")).toContainText("Changes saved");
    await expect(page.getByTestId(`form-edit-note-${first}`)).toBeVisible();
    await expect(page.getByTestId("input-edit-note")).toHaveCount(1);
    await page.reload();
    await expect(page.getByTestId(`entry-progress-${second}`)).toContainText("Second panel, cables crossed right");
  });

  await test.step("renames the yarn's color in the stash and the project follows (#79)", async () => {
    await page.goto(`/stash/${fishermanId}`);
    await page.getByTestId("input-stash-color").fill("Fisherman Cream");
    await page.getByTestId("button-save-yarn").click();
    await expect(page).toHaveURL(/\/stash$/);
    await page.goto(projectUrl);
    await expect(page.getByTestId("list-project-yarns")).toContainText("Lion Brand Wool-Ease · Fisherman Cream");
  });

  await test.step("sees the project and brand on the Overview (#81)", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("link-stat-in-progress")).toContainText("1");
    await expect(page.getByTestId("text-top-yarn-brand")).toHaveText("Lion Brand");
  });

  await test.step("finishes the throw and updates the skeins left (#80)", async () => {
    await page.goto(projectUrl);
    await page.getByTestId("button-edit-project").click();
    await page.getByTestId("select-edit-status").selectOption("completed");
    await page.getByTestId("button-update-project").click();
    const suggestion = page.locator('[data-testid^="skein-suggestion-"]');
    await expect(suggestion).toContainText("used 3 skeins of Lion Brand Wool-Ease Fisherman Cream. Update skeins left from 4 to 1?");
    await page.locator('[data-testid^="button-update-skeins-"]').click();
    await expect(suggestion).toHaveCount(0);
  });

  await test.step("uses up the yarn and moves it to the Archive (#82)", async () => {
    await page.goto(`/stash/${fishermanId}`);
    await expect(page.getByTestId("input-skeins-left")).toHaveValue("1");
    await page.getByTestId("input-skeins-left").fill("0");
    await page.getByTestId("button-save-yarn").click();
    await expect(page.getByTestId(`archive-nudge-${fishermanId}`)).toContainText("All used up.");
    await page.getByTestId("button-move-to-archive").click();
    await expect(page).toHaveURL(/\/stash$/);
    await expect(page.getByTestId("signpost")).toContainText("Moved Lion Brand Wool-Ease Fisherman Cream to your Archive.");
    await expect(page.getByTestId(`card-stash-yarn-${fishermanId}`)).toHaveCount(0);
    await page.getByTestId("button-archive-filter").click();
    await expect(page.getByTestId(`card-stash-yarn-${fishermanId}`)).toBeVisible();
  });

  await test.step("buys it again and gets the same yarn back from the Archive (#82)", async () => {
    await page.goto("/stash/new");
    await page.getByTestId("input-stash-photo").setInputFiles({ name: "skein.png", mimeType: "image/png", buffer: photo });
    await page.getByTestId("input-stash-brand").fill("Lion Brand");
    await page.getByTestId("input-stash-sub-brand").fill("Wool-Ease");
    await page.getByTestId("input-stash-color").fill("fisherman cream");
    await page.getByTestId("input-skeins-purchased").fill("5");
    await page.getByTestId("button-save-yarn").click();
    await expect(page).toHaveURL(/\/stash$/);
    await expect(page.getByTestId("signpost")).toContainText("Welcome back");
    await expect(page.getByTestId(`card-stash-yarn-${fishermanId}`)).toBeVisible();
    await expect(page.getByText("2 yarns")).toBeVisible();
  });
});
