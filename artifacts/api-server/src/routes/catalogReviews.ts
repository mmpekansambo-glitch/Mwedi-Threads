import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  CreateCatalogReviewBody,
  CreateCatalogReviewResponse,
  GetCatalogReviewAccessResponse,
  GetCatalogReviewsResponse,
  GetStashYarnReviewsParams,
  GetStashYarnReviewsResponse,
  ResolveCatalogReviewBody,
  ResolveCatalogReviewParams,
  ResolveCatalogReviewResponse,
} from "@workspace/api-zod";
import {
  catalogReviewsTable,
  db,
  projectYarnsTable,
  stashYarnsTable,
  usersTable,
  yarnBrandsTable,
  yarnColorsTable,
  yarnLinesTable,
  type CatalogReview,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { matchKey, tidyName } from "../lib/yarnCatalog";
import type { Transaction } from "../lib/yarnCatalogStore";

const router: IRouter = Router();

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

// The catalog reviewer is set by email in the CATALOG_REVIEWER_EMAILS
// secret (several can be separated with commas).
async function isReviewer(userId: string): Promise<boolean> {
  const emails = (process.env.CATALOG_REVIEWER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return false;
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return Boolean(user?.email && emails.includes(user.email.toLowerCase()));
}

function serializeReview(review: CatalogReview, requesterName: string | null = null) {
  return {
    id: review.id,
    stashYarnId: review.stashYarnId,
    field: review.field,
    currentName: review.currentName,
    suggestedName: review.suggestedName,
    note: review.note,
    status: review.status,
    reviewerNote: review.reviewerNote,
    requesterName,
    createdAt: review.createdAt,
    resolvedAt: review.resolvedAt,
  };
}

const fieldLabels = { brand: "brand", sub_brand: "sub brand", color: "color" } as const;

// Renames a catalog entry and every stash and project yarn that uses it.
// Returns an error when another entry already has the new name.
async function renameCatalogEntry(
  tx: Transaction,
  review: CatalogReview,
  newName: string,
): Promise<string | null> {
  const key = matchKey(newName);
  if (review.field === "brand") {
    const [clash] = await tx
      .select({ id: yarnBrandsTable.id })
      .from(yarnBrandsTable)
      .where(and(eq(yarnBrandsTable.matchKey, key), ne(yarnBrandsTable.id, review.catalogId)));
    if (clash) return "Another brand already has that name.";
    await tx.update(yarnBrandsTable).set({ name: newName, matchKey: key }).where(eq(yarnBrandsTable.id, review.catalogId));
    await tx.update(stashYarnsTable).set({ brand: newName }).where(eq(stashYarnsTable.brandId, review.catalogId));
    await tx.execute(sql`update ${projectYarnsTable} set brand = ${newName} where stash_yarn_id in (select id from ${stashYarnsTable} where brand_id = ${review.catalogId})`);
    return null;
  }
  if (review.field === "sub_brand") {
    const [line] = await tx.select().from(yarnLinesTable).where(eq(yarnLinesTable.id, review.catalogId));
    if (!line) return "That sub brand is no longer in the catalog.";
    const [clash] = await tx
      .select({ id: yarnLinesTable.id })
      .from(yarnLinesTable)
      .where(and(eq(yarnLinesTable.brandId, line.brandId), eq(yarnLinesTable.matchKey, key), ne(yarnLinesTable.id, line.id)));
    if (clash) return "This brand already has a sub brand with that name.";
    await tx.update(yarnLinesTable).set({ name: newName, matchKey: key }).where(eq(yarnLinesTable.id, line.id));
    await tx.update(stashYarnsTable).set({ subBrand: newName }).where(eq(stashYarnsTable.lineId, line.id));
    await tx.execute(sql`update ${projectYarnsTable} set sub_brand = ${newName} where stash_yarn_id in (select id from ${stashYarnsTable} where line_id = ${line.id})`);
    return null;
  }
  const [color] = await tx.select().from(yarnColorsTable).where(eq(yarnColorsTable.id, review.catalogId));
  if (!color) return "That color is no longer in the catalog.";
  const [clash] = await tx
    .select({ id: yarnColorsTable.id })
    .from(yarnColorsTable)
    .where(and(eq(yarnColorsTable.lineId, color.lineId), eq(yarnColorsTable.matchKey, key), ne(yarnColorsTable.id, color.id)));
  if (clash) return "This sub brand already has a color with that name.";
  await tx.update(yarnColorsTable).set({ name: newName, matchKey: key }).where(eq(yarnColorsTable.id, color.id));
  await tx.update(stashYarnsTable).set({ color: newName }).where(eq(stashYarnsTable.colorId, color.id));
  await tx.execute(sql`update ${projectYarnsTable} set color = ${newName} where stash_yarn_id in (select id from ${stashYarnsTable} where color_id = ${color.id})`);
  return null;
}

router.get("/catalog-reviews/access", requireAuth, async (_req, res): Promise<void> => {
  res.json(GetCatalogReviewAccessResponse.parse({ reviewer: await isReviewer(getOwnerId(res)) }));
});

router.get("/catalog-reviews", requireAuth, async (_req, res): Promise<void> => {
  if (!(await isReviewer(getOwnerId(res)))) {
    res.status(403).json({ error: "Only the catalog reviewer can see reviews." });
    return;
  }
  const rows = await db
    .select({ review: catalogReviewsTable, requesterName: usersTable.displayName, requesterEmail: usersTable.email })
    .from(catalogReviewsTable)
    .leftJoin(usersTable, eq(catalogReviewsTable.requesterId, usersTable.id))
    .orderBy(sql`${catalogReviewsTable.status} <> 'open'`, desc(catalogReviewsTable.createdAt))
    .limit(200);
  res.json(GetCatalogReviewsResponse.parse(
    rows.map((row) => serializeReview(row.review, row.requesterName ?? row.requesterEmail)),
  ));
});

router.post("/catalog-reviews", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCatalogReviewBody.safeParse(req.body);
  if (!parsed.success || !matchKey(parsed.data.suggestedName)) {
    res.status(400).json({ error: "Enter the name you think it should be." });
    return;
  }

  const ownerId = getOwnerId(res);
  const [yarn] = await db
    .select()
    .from(stashYarnsTable)
    .where(and(eq(stashYarnsTable.id, parsed.data.stashYarnId), eq(stashYarnsTable.ownerId, ownerId)));
  if (!yarn) {
    res.status(404).json({ error: "Yarn not found." });
    return;
  }
  const { field } = parsed.data;
  const target = field === "brand"
    ? { id: yarn.brandId, name: yarn.brand }
    : field === "sub_brand"
      ? { id: yarn.lineId, name: yarn.subBrand }
      : { id: yarn.colorId, name: yarn.color };
  if (!target.id || !target.name) {
    res.status(400).json({ error: `This yarn's ${fieldLabels[field]} isn't in the shared catalog.` });
    return;
  }

  const [created] = await db
    .insert(catalogReviewsTable)
    .values({
      requesterId: ownerId,
      stashYarnId: yarn.id,
      field,
      catalogId: target.id,
      currentName: target.name,
      suggestedName: tidyName(parsed.data.suggestedName),
      note: parsed.data.note?.trim() || null,
    })
    .returning();
  res.status(201).json(CreateCatalogReviewResponse.parse(serializeReview(created)));
});

router.post("/catalog-reviews/:reviewId/resolve", requireAuth, async (req, res): Promise<void> => {
  const params = ResolveCatalogReviewParams.safeParse(req.params);
  const parsed = ResolveCatalogReviewBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Check the review and try again." });
    return;
  }
  if (!(await isReviewer(getOwnerId(res)))) {
    res.status(403).json({ error: "Only the catalog reviewer can resolve reviews." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [review] = await tx
      .select()
      .from(catalogReviewsTable)
      .where(eq(catalogReviewsTable.id, params.data.reviewId))
      .for("update");
    if (!review) return { status: 404 as const, error: "Review not found." };
    if (parsed.data.action === "rename") {
      const newName = parsed.data.name ? tidyName(parsed.data.name) : review.suggestedName;
      if (!matchKey(newName)) return { status: 400 as const, error: "Enter the new name." };
      const error = await renameCatalogEntry(tx, review, newName);
      if (error) return { status: 400 as const, error };
    }
    const [saved] = await tx
      .update(catalogReviewsTable)
      .set({
        status: parsed.data.action === "rename" ? "renamed" : "kept",
        reviewerNote: parsed.data.reviewerNote?.trim() || null,
        resolvedAt: new Date(),
      })
      .where(eq(catalogReviewsTable.id, review.id))
      .returning();
    return { status: 200 as const, review: saved };
  });
  if (result.status !== 200) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(ResolveCatalogReviewResponse.parse(serializeReview(result.review)));
});

router.get("/yarn-stash/:yarnId/reviews", requireAuth, async (req, res): Promise<void> => {
  const params = GetStashYarnReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid yarn ID." });
    return;
  }

  const ownerId = getOwnerId(res);
  const rows = await db
    .select()
    .from(catalogReviewsTable)
    .where(and(eq(catalogReviewsTable.stashYarnId, params.data.yarnId), eq(catalogReviewsTable.requesterId, ownerId)))
    .orderBy(desc(catalogReviewsTable.createdAt), asc(catalogReviewsTable.id));
  res.json(GetStashYarnReviewsResponse.parse(rows.map((row) => serializeReview(row))));
});

export default router;
