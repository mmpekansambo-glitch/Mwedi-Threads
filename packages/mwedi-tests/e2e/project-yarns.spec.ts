import { expect, test, type Page } from "@playwright/test";

const projectId = "project-yarns-e2e";
const stashId = "bbbbbbbb-0000-4000-8000-000000000001";
const photolessId = "bbbbbbbb-0000-4000-8000-000000000002";
const suggestionId = "cccccccc-0000-4000-8000-000000000001";
const reviewId = "dddddddd-0000-4000-8000-000000000001";

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId, title: "Striped blanket", craft: "crochet", status: "in_progress",
    description: null, patternName: null, patternDesigner: null, designerWebsite: null, designerPageTitle: null,
    yarn: null, yarns: [], tools: null, hookSize: null,
    needleSize: null, needleType: null, needleCableLength: null, secondNeedleSize: null, secondNeedleType: null, secondNeedleCableLength: null,
    startedAt: null, startedAtPrecision: "day", targetDate: null, targetDatePrecision: "day",
    completedAt: null, completedAtPrecision: "day", starred: false,
    progressMethod: "estimate", progressTotal: null, progressSections: [],
    completionPercent: 40, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

function stashYarn(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, brand: "Lion Brand", subBrand: "Wool-Ease", color: "Fisherman", generalColor: "cream", weight: "worsted",
    blend: [], brandLink: null, photoPath: `/objects/stash/user/${id}`, skeinsPurchased: 4, skeinsLeft: 4,
    createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z",
    ...overrides,
  };
}

const stash = [
  stashYarn(stashId),
  stashYarn(photolessId, { brand: "Knit Picks", subBrand: "Brava", color: "Cotton Candy", generalColor: null, weight: null, photoPath: null, skeinsPurchased: null, skeinsLeft: null }),
];

const review = {
  id: reviewId, stashYarnId: stashId, field: "sub_brand", currentName: "Wool-Ease", suggestedName: "Wool-Ease Classic",
  note: "The label says Classic.", status: "open", reviewerNote: null, requesterName: "Maker",
  createdAt: "2026-10-19T08:00:00.000Z", resolvedAt: null,
};

type Sent = { create?: any; update?: any; accepted?: boolean; review?: any; resolve?: any };

async function mockApi(page: Page, sent: Sent, options: { reviewer?: boolean; current?: Record<string, unknown> } = {}) {
  let suggestions = [{
    id: suggestionId, stashYarnId: stashId, projectId, projectTitle: "Striped blanket",
    yarnName: "Lion Brand Wool-Ease Fisherman", skeinsUsed: 2.5, skeinsLeft: 4, suggestedLeft: 1.5,
  }];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();
    if (pathname === "/api/yarn-catalog") {
      return route.fulfill({ json: { brands: [], subBrands: [], colors: [], fibers: [], suggestions: { brand: url.searchParams.get("brand") === "Cascde" ? "Cascade" : null, subBrand: null, color: null } } });
    }
    if (pathname === "/api/catalog-reviews/access") return route.fulfill({ json: { reviewer: Boolean(options.reviewer) } });
    if (pathname === "/api/catalog-reviews" && method === "GET") return route.fulfill({ json: [review] });
    if (pathname === "/api/catalog-reviews" && method === "POST") {
      sent.review = request.postDataJSON();
      return route.fulfill({ status: 201, json: { ...review, ...sent.review, currentName: "Lion Brand", status: "open" } });
    }
    if (pathname === `/api/catalog-reviews/${reviewId}/resolve`) {
      sent.resolve = request.postDataJSON();
      return route.fulfill({ json: { ...review, status: "renamed", reviewerNote: sent.resolve.reviewerNote } });
    }
    if (pathname.endsWith("/reviews")) return route.fulfill({ json: sent.review ? [{ ...review, field: "brand", currentName: "Lion Brand", suggestedName: sent.review.suggestedName }] : [] });
    if (pathname === "/api/yarn-stash/skein-suggestions") {
      const projectFilter = url.searchParams.get("projectId");
      return route.fulfill({ json: suggestions.filter((item) => !projectFilter || item.projectId === projectFilter) });
    }
    if (pathname === `/api/yarn-stash/skein-suggestions/${suggestionId}/accept`) {
      sent.accepted = true;
      suggestions = [];
      return route.fulfill({ json: stashYarn(stashId, { skeinsLeft: 1.5 }) });
    }
    if (pathname.match(/^\/api\/yarn-stash\/[^/]+\/photo$/)) return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#F1E6CF"/></svg>' });
    if (pathname === "/api/yarn-stash") return route.fulfill({ json: sent.accepted ? [stashYarn(stashId, { skeinsLeft: 1.5 }), stash[1]] : stash });
    const stashMatch = pathname.match(/^\/api\/yarn-stash\/([^/]+)$/);
    if (stashMatch) return route.fulfill({ json: stash.find((item) => item.id === stashMatch[1]) });
    if (pathname === "/api/projects" && method === "POST") {
      sent.create = request.postDataJSON();
      return route.fulfill({ status: 201, json: project({ ...sent.create }) });
    }
    if (pathname === `/api/projects/${projectId}` && method === "PATCH") {
      sent.update = request.postDataJSON();
      return route.fulfill({ json: project({ ...options.current, ...sent.update }) });
    }
    if (pathname === `/api/projects/${projectId}`) return route.fulfill({ json: { ...project(options.current), progress: [] } });
    return route.fulfill({ json: [] });
  });
}

test("lists several yarns on a new project, picked from the stash or typed in", async ({ page }) => {
  const sent: Sent = {};
  await mockApi(page, sent);
  await page.goto("/projects/new");
  await page.getByTestId("input-project-title").fill("Striped blanket");
  await page.getByTestId("project-yarn-0-stash").selectOption(stashId);
  await expect(page.getByTestId("project-yarn-0-brand")).toHaveValue("Lion Brand");
  await expect(page.getByTestId("project-yarn-0-color")).toHaveValue("Fisherman");
  await page.getByTestId("project-yarn-0-skeins").fill("2.5");

  await page.getByTestId("project-add-color").click();
  await expect(page.getByTestId("project-yarn-1-brand")).toHaveValue("Lion Brand");
  await expect(page.getByTestId("project-yarn-1-sub-brand")).toHaveValue("Wool-Ease");
  await page.getByTestId("project-yarn-1-color").fill("Cranberry");

  await page.getByTestId("project-add-yarn").click();
  await page.getByTestId("project-yarn-2-brand").fill("Cascde");
  await page.getByTestId("project-yarn-2-did-you-mean-brand").click();
  await expect(page.getByTestId("project-yarn-2-brand")).toHaveValue("Cascade");
  await page.getByTestId("project-yarn-2-sub-brand").fill("Mohair Lace");
  await page.getByTestId("project-yarn-2-held").check();
  if (process.env.STASH_SCREENSHOTS) await page.getByTestId("project-yarn-0").locator("..").screenshot({ path: `${process.env.STASH_SCREENSHOTS}/project-yarns-form.png` });

  await page.getByTestId("project-yarn-1-skeins").fill("1.3");
  await page.getByTestId("button-save-project").click();
  await expect(page.getByText("Enter skeins used in whole or half skeins, like 2 or 1.5.")).toBeVisible();
  await page.getByTestId("project-yarn-1-skeins").fill("1");
  await page.getByTestId("button-save-project").click();

  await expect.poll(() => sent.create?.yarns).toEqual([
    { stashYarnId: stashId, brand: "Lion Brand", subBrand: "Wool-Ease", color: "Fisherman", heldTogether: false, skeinsUsed: 2.5 },
    { stashYarnId: null, brand: "Lion Brand", subBrand: "Wool-Ease", color: "Cranberry", heldTogether: false, skeinsUsed: 1 },
    { stashYarnId: null, brand: "Cascade", subBrand: "Mohair Lace", color: null, heldTogether: true, skeinsUsed: null },
  ]);
});

test("shows every yarn on the project page and asks to update skeins left", async ({ page }) => {
  const sent: Sent = {};
  await mockApi(page, sent, {
    current: {
      status: "completed",
      yarns: [
        { id: "y1", stashYarnId: stashId, brand: "Lion Brand", subBrand: "Wool-Ease", color: "Fisherman", generalColor: "cream", heldTogether: false, skeinsUsed: 2.5 },
        { id: "y2", stashYarnId: null, brand: "Cascade", subBrand: "Mohair Lace", color: null, generalColor: null, heldTogether: true, skeinsUsed: null },
      ],
    },
  });
  await page.goto(`/projects/${projectId}`);
  const list = page.getByTestId("list-project-yarns");
  await expect(list).toContainText("Lion Brand Wool-Ease · Fisherman");
  await expect(list).toContainText("2.5 skeins used");
  await expect(list).toContainText("Held with the yarn above");
  await expect(list.getByRole("link", { name: "Lion Brand Wool-Ease · Fisherman" })).toHaveAttribute("href", `/stash/${stashId}`);
  const suggestion = page.getByTestId(`skein-suggestion-${suggestionId}`);
  await expect(suggestion).toContainText("used 2.5 skeins of Lion Brand Wool-Ease Fisherman. Update skeins left from 4 to 1.5?");
  if (process.env.STASH_SCREENSHOTS) await page.screenshot({ path: `${process.env.STASH_SCREENSHOTS}/project-yarns-page.png`, fullPage: true });
  await page.getByTestId(`button-update-skeins-${suggestionId}`).click();
  await expect(suggestion).toHaveCount(0);
  expect(sent.accepted).toBe(true);
});

test("marks stash yarn that needs a photo and lets a maker ask for a name review", async ({ page }) => {
  const sent: Sent = {};
  await mockApi(page, sent);
  await page.goto("/stash");
  await expect(page.getByTestId(`card-stash-yarn-${photolessId}`)).toContainText("Needs a photo");
  await expect(page.getByTestId(`skein-suggestion-${suggestionId}`)).toBeVisible();
  await expect(page.getByTestId("link-reviews")).toHaveCount(0);
  if (process.env.STASH_SCREENSHOTS) await page.screenshot({ path: `${process.env.STASH_SCREENSHOTS}/stash-needs-photo.png`, fullPage: true });

  await page.goto(`/stash/${stashId}`);
  await page.getByTestId("button-review-brand").click();
  await page.getByTestId("input-review-name-brand").fill("Lion Brand Yarn");
  await page.getByTestId("input-review-note-brand").fill("That's the company name.");
  await page.getByTestId("button-send-review-brand").click();
  await expect.poll(() => sent.review).toEqual({ stashYarnId: stashId, field: "brand", suggestedName: "Lion Brand Yarn", note: "That's the company name." });
  await expect(page.getByTestId("list-name-reviews")).toContainText("Waiting for review");
});

test("lets the reviewer rename a catalog entry from the review page", async ({ page }) => {
  const sent: Sent = {};
  await mockApi(page, sent, { reviewer: true });
  await page.goto("/stash");
  await page.getByTestId("link-reviews").click();
  const card = page.getByTestId(`card-review-${reviewId}`);
  await expect(card).toContainText("Wool-Ease → Wool-Ease Classic");
  await expect(card).toContainText("The label says Classic.");
  await page.getByTestId(`input-review-reply-${reviewId}`).fill("Fixed, thanks.");
  if (process.env.STASH_SCREENSHOTS) await page.screenshot({ path: `${process.env.STASH_SCREENSHOTS}/name-reviews.png`, fullPage: true });
  await page.getByTestId(`button-rename-${reviewId}`).click();
  await expect.poll(() => sent.resolve).toEqual({ action: "rename", name: "Wool-Ease Classic", reviewerNote: "Fixed, thanks." });
});
