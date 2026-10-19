import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const photo = readFileSync(fileURLToPath(new URL("../fixtures/yarn-photo.png", import.meta.url)));

function yarnBall(fill: string, line: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#EEF2F9"/><circle cx="50" cy="53" r="34" fill="${fill}"/><g fill="none" stroke="${line}" stroke-width="2.5"><path d="M22 40c20 8 40 30 48 44"/><path d="M28 30c18 10 38 34 44 50"/><path d="M40 21c14 14 30 38 32 56"/><path d="M18 58c22-6 46-22 56-34"/></g></svg>`;
}

function yarn(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, brand: "Lion Brand", subBrand: "Wool-Ease", color: "Fisherman", generalColor: "cream", weight: "worsted",
    blend: [{ fiber: "Acrylic", percent: 80 }, { fiber: "Wool", percent: 20 }],
    brandLink: null, photoPath: `/objects/stash/user/${id}`, skeinsPurchased: 4, skeinsLeft: 2.5,
    createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z",
    ...overrides,
  };
}

const stash = [
  yarn("aaaaaaaa-0000-4000-8000-000000000001"),
  yarn("aaaaaaaa-0000-4000-8000-000000000002", { color: "Cranberry", generalColor: "red", skeinsPurchased: 2, skeinsLeft: 2 }),
  yarn("aaaaaaaa-0000-4000-8000-000000000003", { brand: "Malabrigo", subBrand: "Rios", color: "Azul Profundo", generalColor: "blue", weight: "worsted", blend: [{ fiber: "Merino", percent: 100 }], skeinsPurchased: 3, skeinsLeft: 1 }),
  yarn("aaaaaaaa-0000-4000-8000-000000000004", { brand: "Cascade", subBrand: "220 Superwash", color: "Lime", generalColor: "green", weight: "worsted", blend: [{ fiber: "Wool", percent: 100 }], skeinsPurchased: 5, skeinsLeft: 5 }),
];
const balls: Record<string, string> = {
  cream: yarnBall("#F1E6CF", "#D9C9A8"), red: yarnBall("#A8323A", "#7E2128"),
  blue: yarnBall("#2F4F8F", "#203A6B"), green: yarnBall("#8DBA4C", "#6A9134"),
};

async function mockApi(page: Page, sent: { create?: unknown; upload?: unknown; catalog: string[] }) {
  await page.route("**/storage.test/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    if (pathname === "/api/yarn-catalog") {
      sent.catalog.push(url.search);
      const brand = url.searchParams.get("brand") ?? "";
      return route.fulfill({ json: {
        brands: ["Lion Brand", "Malabrigo"].filter((name) => name.toLowerCase().includes(brand.toLowerCase().slice(0, 3))),
        subBrands: brand === "Lion Brand" ? [{ name: "Wool-Ease", blend: [{ fiber: "Acrylic", percent: 80 }, { fiber: "Wool", percent: 20 }], link: "https://www.lionbrand.com/wool-ease" }] : [],
        colors: url.searchParams.get("subBrand") === "Wool-Ease" ? [{ name: "Fisherman", generalColor: "cream" }] : [],
        fibers: ["Acrylic", "Cotton", "Merino", "Wool"],
        suggestions: { brand: brand === "Lion Brnad" ? "Lion Brand" : null, subBrand: null, color: null },
      } });
    }
    if (pathname === "/api/yarn-stash/photo-upload") {
      sent.upload = request.postDataJSON();
      return route.fulfill({ json: { uploadURL: "https://storage.test/upload", photoPath: "/objects/stash/user/aaaaaaaa-0000-4000-8000-0000000000ff" } });
    }
    if (pathname === "/api/yarn-stash" && request.method() === "POST") {
      sent.create = request.postDataJSON();
      return route.fulfill({ status: 201, json: yarn("aaaaaaaa-0000-4000-8000-000000000009", sent.create as object) });
    }
    const photoMatch = pathname.match(/^\/api\/yarn-stash\/(.+)\/photo$/);
    if (photoMatch) {
      const item = stash.find((entry) => entry.id === photoMatch[1]);
      return route.fulfill({ contentType: "image/svg+xml", body: balls[String(item?.generalColor ?? "cream")] });
    }
    if (pathname === "/api/yarn-stash") {
      const weight = url.searchParams.get("weight");
      const color = url.searchParams.get("generalColor");
      return route.fulfill({ json: stash.filter((item) => (!weight || item.weight === weight) && (!color || item.generalColor === color)) });
    }
    const itemMatch = pathname.match(/^\/api\/yarn-stash\/([^/]+)$/);
    if (itemMatch) return route.fulfill({ json: stash.find((entry) => entry.id === itemMatch[1]) });
    return route.fulfill({ json: [] });
  });
}

test("shows the stash with photos, color dots and filters", async ({ page }) => {
  await mockApi(page, { catalog: [] });
  await page.goto("/stash");
  await expect(page.getByTestId("link-stash")).toHaveClass(/selected/);
  await expect(page.getByText("4 yarns")).toBeVisible();
  const card = page.getByTestId("card-stash-yarn-aaaaaaaa-0000-4000-8000-000000000001");
  await expect(card).toContainText("Lion Brand Wool-Ease");
  await expect(card).toContainText("Fisherman");
  await expect(card).toContainText("2.5 of 4 skeins left");
  await expect(card.getByRole("img", { name: "Cream yarn" })).toBeVisible();
  if (process.env.STASH_SCREENSHOTS) await page.screenshot({ path: `${process.env.STASH_SCREENSHOTS}/stash-web.png`, fullPage: true });
  await page.getByTestId("select-color-filter").selectOption("red");
  await expect(page.getByText("1 yarn", { exact: true })).toBeVisible();
  await expect(page.getByTestId("card-stash-yarn-aaaaaaaa-0000-4000-8000-000000000002")).toBeVisible();
});

test("adds a yarn with a photo, Did you mean, weight wheel and blend", async ({ page }) => {
  const sent: { create?: unknown; upload?: unknown; catalog: string[] } = { catalog: [] };
  await mockApi(page, sent);
  await page.goto("/stash/new");
  await page.getByTestId("button-save-yarn").click();
  await expect(page.getByText("Enter the yarn’s brand.")).toBeVisible();
  await expect(page.getByText("Add a photo of this yarn.")).toBeVisible();

  await page.getByTestId("input-stash-photo").setInputFiles({ name: "skein.png", mimeType: "image/png", buffer: photo });
  await page.getByTestId("input-stash-brand").fill("Lion Brnad");
  await page.getByTestId("button-did-you-mean-brand").click();
  await expect(page.getByTestId("input-stash-brand")).toHaveValue("Lion Brand");
  await page.getByTestId("input-stash-sub-brand").fill("Wool-Ease");
  await expect(page.getByTestId("select-blend-fiber-0")).toHaveValue("Acrylic");
  await expect(page.getByTestId("input-stash-link")).toHaveValue("https://www.lionbrand.com/wool-ease");
  await page.getByTestId("input-stash-color").fill("Fisherman");
  await expect(page.getByTestId("button-general-color-cream")).toHaveAttribute("aria-checked", "true");

  await page.getByTestId("input-stash-weight").click();
  await page.getByTestId("input-stash-weight-wheel").getByText("4 · Worsted").click();
  if (process.env.STASH_SCREENSHOTS) await page.screenshot({ path: `${process.env.STASH_SCREENSHOTS}/stash-form-web.png`, fullPage: true });
  await page.getByTestId("input-stash-weight-done").click();
  await expect(page.getByTestId("input-stash-weight")).toContainText("4 · Worsted");

  await page.getByTestId("input-blend-percent-0").fill("70");
  await page.getByTestId("button-save-yarn").click();
  await expect(page.getByText("The blend adds up to 90%. Make it add up to 100%.")).toBeVisible();
  await page.getByTestId("input-blend-percent-0").fill("80");
  await page.getByTestId("input-skeins-purchased").fill("4");
  await page.getByTestId("button-save-yarn").click();

  await expect.poll(() => sent.create).toMatchObject({
    brand: "Lion Brand", subBrand: "Wool-Ease", color: "Fisherman", generalColor: "cream", weight: "worsted",
    blend: [{ fiber: "Acrylic", percent: 80 }, { fiber: "Wool", percent: 20 }],
    brandLink: "https://www.lionbrand.com/wool-ease",
    photoPath: "/objects/stash/user/aaaaaaaa-0000-4000-8000-0000000000ff",
    skeinsPurchased: 4, skeinsLeft: null,
  });
  expect(sent.upload).toMatchObject({ contentType: "image/png", name: "skein.png" });
  await expect(page).toHaveURL(/\/stash$/);
});
