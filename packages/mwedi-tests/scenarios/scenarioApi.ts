import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const scenarioApi = "http://127.0.0.1:22864";
export const photo = readFileSync(fileURLToPath(new URL("../fixtures/yarn-photo.png", import.meta.url)));

// Sends the page's API calls to the scenario API as this maker, and answers
// the photo storage calls the real app would make to object storage.
export async function signInAs(page: Page, makerId: string): Promise<void> {
  await page.route("**/storage.test/**", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ contentType: "image/png", body: photo })
      : route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const response = await route.fetch({
      url: `${scenarioApi}${url.pathname}${url.search}`,
      headers: { ...request.headers(), "x-test-user": makerId },
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
}

// What the print photo check answers when new fabric looks like fabric in
// the Archive: true (same print), false (clearly different) or null (can't tell).
export async function printPhotosLookAlike(answer: boolean | null): Promise<void> {
  await fetch(`${scenarioApi}/scenario/print-photos`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lookAlike: answer }),
  });
}
