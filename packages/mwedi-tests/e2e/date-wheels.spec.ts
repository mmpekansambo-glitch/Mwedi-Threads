import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/projects/new");
});

test("picks a month and year by scrolling, with the day left on the dash", async ({ page }) => {
  await page.getByTestId("input-start-date").click();
  await expect(page.getByTestId("input-start-date-day").getByRole("option", { selected: true })).toHaveText("—");
  await page.getByTestId("input-start-date-month").evaluate((wheel) => { wheel.scrollTop = 5 * 42; });
  await expect(page.getByTestId("input-start-date-month").getByRole("option", { selected: true })).toHaveText("June");
  await page.getByTestId("input-start-date-done").click();
  await expect(page.getByTestId("input-start-date")).toHaveText(`June ${new Date().getFullYear()}`);
});

test("adds a day with the keyboard and clears the date", async ({ page }) => {
  await page.getByTestId("input-start-date").click();
  await page.getByTestId("input-start-date-month").getByRole("option", { name: "February", exact: true }).click();
  await page.getByTestId("input-start-date-day").focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("input-start-date-day").getByRole("option", { selected: true })).toHaveText(/^(28|29)$/);
  await page.keyboard.press("ArrowUp");
  await page.getByTestId("input-start-date-done").click();
  await expect(page.getByTestId("input-start-date")).toHaveText(/^February (27|28), \d{4}$/);
  await page.getByTestId("input-start-date-clear").click();
  await expect(page.getByTestId("input-start-date")).toHaveText("Choose a date");
});
