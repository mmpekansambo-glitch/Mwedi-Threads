import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mwedi-e2e-signed-out", "1"));
});

test("signed-out landing page shows the headline, sign up and sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your hands are busy.");
  await expect(page.getByTestId("link-get-started")).toHaveAttribute("href", "/sign-up");
  await expect(page.getByTestId("link-sign-in")).toHaveAttribute("href", "/sign-in");
  await expect(page.getByText("A little home for your making")).toHaveCount(0);
});

test("the About link opens the About page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("link-about").click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("About Mwedi Threads");
  await expect(page.getByText("Made by Mwengwe Mpekansambo.")).toBeVisible();
});
