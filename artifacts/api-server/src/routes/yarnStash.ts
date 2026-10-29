import { and, asc, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  AcceptSkeinSuggestionParams,
  CreateStashYarnBody,
  DismissSkeinSuggestionParams,
  GetSkeinSuggestionsQueryParams,
  GetSkeinSuggestionsResponse,
  DeleteStashYarnParams,
  GetStashYarnParams,
  GetStashYarnPhotoParams,
  GetStashYarnResponse,
  GetStashYarnsQueryParams,
  GetYarnCatalogQueryParams,
  GetYarnCatalogResponse,
  RequestStashPhotoUploadBody,
  RenameStashYarnsBody,
  RenameStashYarnsResponse,
  RequestStashPhotoUploadResponse,
  UpdateStashYarnBody,
  UpdateStashYarnParams,
} from "@workspace/api-zod";
import {
  db,
  projectYarnsTable,
  projectsTable,
  skeinSuggestionsTable,
  stashYarnsTable,
  yarnBrandsTable,
  yarnColorsTable,
  yarnLinesTable,
  type StashYarn,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteStoredObject, signedObjectUrl, storageLocation } from "../lib/objectStorage";
import {
  addToCatalog,
  fixCatalogSpelling,
  pruneUnusedCatalog,
  type CatalogInput,
  type Transaction,
} from "../lib/yarnCatalogStore";
import { skeinsAfter } from "../lib/projectYarns";
import {
  checkBlend,
  checkSkeins,
  defaultFibers,
  isWebLink,
  matchKey,
  suggestName,
  tidyName,
  type BlendPart,
} from "../lib/yarnCatalog";

const router: IRouter = Router();
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoSize = 10 * 1024 * 1024;

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

function serializeStashYarn(yarn: StashYarn) {
  return GetStashYarnResponse.parse(yarn);
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Stash photos live under the owner's own folder, so a yarn can only point
// at a photo its owner uploaded.
function isOwnStashPhoto(ownerId: string, photoPath: string): boolean {
  return new RegExp(`^/objects/stash/${escapeForRegExp(ownerId)}/[0-9a-f-]{36}$`, "i").test(photoPath);
}

async function knownFibers(): Promise<string[]> {
  const result = await db.execute<{ fiber: string }>(
    sql`select distinct part->>'fiber' as fiber from ${yarnLinesTable}, jsonb_array_elements(${yarnLinesTable.blend}) as part`,
  );
  const byKey = new Map(defaultFibers.map((fiber) => [matchKey(fiber), fiber]));
  for (const { fiber } of result.rows) {
    if (fiber && !byKey.has(matchKey(fiber))) byKey.set(matchKey(fiber), fiber);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

type YarnDetails = CatalogInput & {
  weight: StashYarn["weight"];
  photoPath: string;
  skeinsPurchased: number | null;
  skeinsLeft: number | null;
};

type DetailsCheck =
  | { ok: true; details: YarnDetails }
  | { ok: false; error: string };

async function checkDetails(ownerId: string, details: YarnDetails): Promise<DetailsCheck> {
  if (!matchKey(details.brand)) return { ok: false, error: "Enter the yarn's brand." };
  if (!isOwnStashPhoto(ownerId, details.photoPath)) {
    return { ok: false, error: "Add a photo of this yarn." };
  }
  const brandLink = details.brandLink?.trim() || null;
  if (brandLink && !isWebLink(brandLink)) {
    return { ok: false, error: "Enter a brand page link starting with http:// or https://." };
  }
  const blend = checkBlend(details.blend, await knownFibers());
  if (!blend.ok) return blend;
  const skeins = checkSkeins(details.skeinsPurchased, details.skeinsLeft);
  if (!skeins.ok) return skeins;
  return {
    ok: true,
    details: {
      ...details,
      brandLink,
      blend: blend.blend,
      skeinsPurchased: skeins.skeinsPurchased,
      skeinsLeft: skeins.skeinsLeft,
    },
  };
}

// Saves the whole edit in one transaction: the stash row, the catalog links,
// and the names on every project yarn linked to it. The row the edit was
// checked against is passed in, already locked, so nothing else can slip a
// change in between.
async function writeYarn(
  tx: Transaction,
  ownerId: string,
  details: Omit<YarnDetails, "photoPath"> & { photoPath: string | null },
  current?: StashYarn,
): Promise<StashYarn | undefined> {
  const linked = await addToCatalog(tx, details);
  const catalogNames = { brand: linked.brand, subBrand: linked.subBrand, color: linked.color };
  // Only a name the maker changed in this edit counts as a spelling fix.
  const changed = (typed: string | null, saved: string | null, catalog: string | null) =>
    typed && tidyName(typed) !== saved ? typed : catalog;
  const names = current
    ? await fixCatalogSpelling(tx, linked, catalogNames, {
      brand: changed(details.brand, current.brand, linked.brand)!,
      subBrand: changed(details.subBrand, current.subBrand, linked.subBrand),
      color: changed(details.color, current.color, linked.color),
    })
    : catalogNames;
  const values = {
    ...linked,
    ...names,
    generalColor: details.generalColor,
    weight: details.weight,
    blend: details.blend,
    brandLink: details.brandLink,
    photoPath: details.photoPath,
    skeinsPurchased: details.skeinsPurchased,
    skeinsLeft: details.skeinsLeft,
  };
  if (!current) {
    const [created] = await tx.insert(stashYarnsTable).values({ ...values, ownerId }).returning();
    return created;
  }
  const [updated] = await tx
    .update(stashYarnsTable)
    .set(values)
    .where(and(eq(stashYarnsTable.id, current.id), eq(stashYarnsTable.ownerId, ownerId)))
    .returning();
  if (!updated) return undefined;
  await tx
    .update(projectYarnsTable)
    .set({ brand: updated.brand, subBrand: updated.subBrand, color: updated.color })
    .where(eq(projectYarnsTable.stashYarnId, updated.id));
  await pruneUnusedCatalog(tx, [current]);
  return updated;
}

async function lockedYarn(tx: Transaction, ownerId: string, yarnId: string): Promise<StashYarn | undefined> {
  const [yarn] = await tx
    .select()
    .from(stashYarnsTable)
    .where(and(eq(stashYarnsTable.id, yarnId), eq(stashYarnsTable.ownerId, ownerId)))
    .for("update");
  return yarn;
}

// The database row is already gone or changed, so removing the stored file
// is cleanup: a failure is logged and the request still succeeds.
async function removeStashPhoto(
  log: { error: (details: object, message: string) => void },
  photoPath: string | null,
) {
  if (!photoPath) return;
  try {
    await deleteStoredObject(photoPath.slice("/objects/".length));
  } catch (error) {
    log.error({ err: error, photoPath }, "Could not delete stored stash photo");
  }
}

router.get("/yarn-catalog", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetYarnCatalogQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid catalog search." });
    return;
  }

  const brandTyped = parsed.data.brand?.trim() ?? "";
  const subBrandTyped = parsed.data.subBrand?.trim() ?? "";
  const colorTyped = parsed.data.color?.trim() ?? "";
  const brandKey = matchKey(brandTyped);

  const [brandMatches, allBrands, fibers] = await Promise.all([
    db
      .select({ name: yarnBrandsTable.name })
      .from(yarnBrandsTable)
      .where(brandKey ? like(yarnBrandsTable.matchKey, `%${brandKey}%`) : undefined)
      .orderBy(asc(yarnBrandsTable.name))
      .limit(20),
    db
      .select({ id: yarnBrandsTable.id, name: yarnBrandsTable.name, matchKey: yarnBrandsTable.matchKey })
      .from(yarnBrandsTable)
      .where(brandKey ? undefined : sql`false`),
    knownFibers(),
  ]);

  const brand = allBrands.find((row) => row.matchKey === brandKey);
  const lines = brand
    ? await db.select().from(yarnLinesTable).where(eq(yarnLinesTable.brandId, brand.id)).orderBy(asc(yarnLinesTable.name))
    : [];
  const line = lines.find((row) => row.matchKey === matchKey(subBrandTyped));
  const colors = line
    ? await db.select().from(yarnColorsTable).where(eq(yarnColorsTable.lineId, line.id)).orderBy(asc(yarnColorsTable.name))
    : [];

  res.json(GetYarnCatalogResponse.parse({
    brands: brandMatches.map((row) => row.name),
    subBrands: lines.map((row) => ({ name: row.name, blend: row.blend, link: row.link })),
    colors: colors.map((row) => ({ name: row.name, generalColor: row.generalColor })),
    fibers,
    suggestions: {
      brand: brandKey ? suggestName(brandTyped, allBrands.map((row) => row.name)) : null,
      subBrand: brand && subBrandTyped ? suggestName(subBrandTyped, lines.map((row) => row.name)) : null,
      color: line && colorTyped ? suggestName(colorTyped, colors.map((row) => row.name)) : null,
    },
  }));
});

router.get("/yarn-stash", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetStashYarnsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid stash filters." });
    return;
  }

  const filters = [eq(stashYarnsTable.ownerId, getOwnerId(res))];
  const search = parsed.data.search?.trim();
  if (search) {
    filters.push(
      or(
        ilike(stashYarnsTable.brand, `%${search}%`),
        ilike(stashYarnsTable.subBrand, `%${search}%`),
        ilike(stashYarnsTable.color, `%${search}%`),
        sql`${stashYarnsTable.blend}::text ilike ${`%${search}%`}`,
      )!,
    );
  }
  if (parsed.data.weight) filters.push(eq(stashYarnsTable.weight, parsed.data.weight));
  if (parsed.data.generalColor) filters.push(eq(stashYarnsTable.generalColor, parsed.data.generalColor));

  const rows = await db
    .select()
    .from(stashYarnsTable)
    .where(and(...filters))
    .orderBy(desc(stashYarnsTable.updatedAt));
  res.json(rows.map(serializeStashYarn));
});

function yarnName(yarn: { brand: string; subBrand: string | null; color: string | null }): string {
  return [yarn.brand, yarn.subBrand, yarn.color].filter(Boolean).join(" ");
}

router.get("/yarn-stash/skein-suggestions", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetSkeinSuggestionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }

  const filters = [
    eq(skeinSuggestionsTable.ownerId, getOwnerId(res)),
    eq(skeinSuggestionsTable.status, "pending"),
  ];
  if (parsed.data.projectId) filters.push(eq(skeinSuggestionsTable.projectId, parsed.data.projectId));
  const rows = await db
    .select({
      id: skeinSuggestionsTable.id,
      stashYarnId: skeinSuggestionsTable.stashYarnId,
      projectId: skeinSuggestionsTable.projectId,
      projectTitle: projectsTable.title,
      skeinsUsed: skeinSuggestionsTable.skeinsUsed,
      brand: stashYarnsTable.brand,
      subBrand: stashYarnsTable.subBrand,
      color: stashYarnsTable.color,
      skeinsLeft: stashYarnsTable.skeinsLeft,
      skeinsPurchased: stashYarnsTable.skeinsPurchased,
    })
    .from(skeinSuggestionsTable)
    .innerJoin(stashYarnsTable, eq(skeinSuggestionsTable.stashYarnId, stashYarnsTable.id))
    .innerJoin(projectsTable, eq(skeinSuggestionsTable.projectId, projectsTable.id))
    .where(and(...filters))
    .orderBy(desc(skeinSuggestionsTable.createdAt));
  // A yarn with no skein count has nothing to take the skeins off.
  res.json(GetSkeinSuggestionsResponse.parse(rows.flatMap((row) => {
    const left = row.skeinsLeft ?? row.skeinsPurchased;
    if (left === null) return [];
    return [{
      id: row.id,
      stashYarnId: row.stashYarnId,
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      yarnName: yarnName(row),
      skeinsUsed: row.skeinsUsed,
      skeinsLeft: left,
      suggestedLeft: skeinsAfter(left, row.skeinsUsed),
    }];
  })));
});

router.post("/yarn-stash/skein-suggestions/:suggestionId/accept", requireAuth, async (req, res): Promise<void> => {
  const params = AcceptSkeinSuggestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid suggestion ID." });
    return;
  }

  const ownerId = getOwnerId(res);
  const updated = await db.transaction(async (tx) => {
    const [suggestion] = await tx
      .select()
      .from(skeinSuggestionsTable)
      .where(and(
        eq(skeinSuggestionsTable.id, params.data.suggestionId),
        eq(skeinSuggestionsTable.ownerId, ownerId),
        eq(skeinSuggestionsTable.status, "pending"),
      ))
      .for("update");
    if (!suggestion) return undefined;
    const [yarn] = await tx
      .select()
      .from(stashYarnsTable)
      .where(and(eq(stashYarnsTable.id, suggestion.stashYarnId), eq(stashYarnsTable.ownerId, ownerId)));
    const left = yarn ? yarn.skeinsLeft ?? yarn.skeinsPurchased : null;
    if (!yarn || left === null) return undefined;
    await tx
      .update(skeinSuggestionsTable)
      .set({ status: "accepted" })
      .where(eq(skeinSuggestionsTable.id, suggestion.id));
    const [saved] = await tx
      .update(stashYarnsTable)
      .set({ skeinsLeft: skeinsAfter(left, suggestion.skeinsUsed) })
      .where(eq(stashYarnsTable.id, yarn.id))
      .returning();
    return saved;
  });
  if (!updated) {
    res.status(404).json({ error: "Suggestion not found." });
    return;
  }
  res.json(serializeStashYarn(updated));
});

router.post("/yarn-stash/skein-suggestions/:suggestionId/dismiss", requireAuth, async (req, res): Promise<void> => {
  const params = DismissSkeinSuggestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid suggestion ID." });
    return;
  }

  const [dismissed] = await db
    .update(skeinSuggestionsTable)
    .set({ status: "dismissed" })
    .where(and(
      eq(skeinSuggestionsTable.id, params.data.suggestionId),
      eq(skeinSuggestionsTable.ownerId, getOwnerId(res)),
      eq(skeinSuggestionsTable.status, "pending"),
    ))
    .returning({ id: skeinSuggestionsTable.id });
  if (!dismissed) {
    res.status(404).json({ error: "Suggestion not found." });
    return;
  }
  res.sendStatus(204);
});

router.post("/yarn-stash/photo-upload", requireAuth, async (req, res): Promise<void> => {
  const parsed = RequestStashPhotoUploadBody.safeParse(req.body);
  if (!parsed.success || !allowedPhotoTypes.has(parsed.data.contentType) || parsed.data.size > maxPhotoSize) {
    res.status(400).json({ error: "Choose a JPEG, PNG, or WebP photo up to 10 MB." });
    return;
  }

  const ownerId = getOwnerId(res);
  try {
    const relativePath = `stash/${ownerId}/${randomUUID()}`;
    const { bucketName, objectName } = storageLocation(relativePath);
    const uploadURL = await signedObjectUrl(bucketName, objectName, "PUT");
    res.json(RequestStashPhotoUploadResponse.parse({ uploadURL, photoPath: `/objects/${relativePath}` }));
  } catch (error) {
    req.log.error({ err: error, ownerId }, "Could not create stash photo upload URL");
    res.status(500).json({ error: "Could not prepare the photo upload." });
  }
});

router.post("/yarn-stash", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateStashYarnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the yarn details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const checked = await checkDetails(ownerId, {
    brand: parsed.data.brand,
    subBrand: parsed.data.subBrand ?? null,
    color: parsed.data.color ?? null,
    generalColor: parsed.data.generalColor ?? null,
    weight: parsed.data.weight ?? null,
    blend: parsed.data.blend ?? [],
    brandLink: parsed.data.brandLink ?? null,
    photoPath: parsed.data.photoPath,
    skeinsPurchased: parsed.data.skeinsPurchased ?? null,
    skeinsLeft: parsed.data.skeinsLeft ?? null,
  });
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }

  const created = await db.transaction((tx) => writeYarn(tx, ownerId, checked.details));
  res.status(201).json(serializeStashYarn(created!));
});

// Renames a brand or sub brand on every other yarn in the maker's stash that
// still has the old name. Each yarn keeps its own color.
router.post("/yarn-stash/rename-all", requireAuth, async (req, res): Promise<void> => {
  const parsed = RenameStashYarnsBody.safeParse(req.body);
  if (!parsed.success || !matchKey(parsed.data.from) || !matchKey(parsed.data.to)) {
    res.status(400).json({ error: "Check the names and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const { field } = parsed.data;
  const fromKey = matchKey(parsed.data.from);
  const to = tidyName(parsed.data.to);
  const brandKey = parsed.data.brand ? matchKey(parsed.data.brand) : null;
  const renamed = await db.transaction(async (tx) => {
    const yarns = await tx
      .select()
      .from(stashYarnsTable)
      .where(eq(stashYarnsTable.ownerId, ownerId))
      .for("update");
    const targets = yarns.filter((yarn) => {
      const name = field === "brand" ? yarn.brand : yarn.subBrand;
      if (!name || matchKey(name) !== fromKey || name === to) return false;
      return field === "brand" || !brandKey || matchKey(yarn.brand) === brandKey;
    });
    for (const yarn of targets) {
      await writeYarn(tx, ownerId, {
        brand: field === "brand" ? to : yarn.brand,
        subBrand: field === "subBrand" ? to : yarn.subBrand,
        color: yarn.color,
        generalColor: yarn.generalColor,
        weight: yarn.weight,
        blend: yarn.blend,
        brandLink: yarn.brandLink,
        photoPath: yarn.photoPath,
        skeinsPurchased: yarn.skeinsPurchased,
        skeinsLeft: yarn.skeinsLeft,
      }, yarn);
    }
    return targets.length;
  });
  res.json(RenameStashYarnsResponse.parse({ renamed }));
});

router.get("/yarn-stash/:yarnId", requireAuth, async (req, res): Promise<void> => {
  const params = GetStashYarnParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid yarn ID." });
    return;
  }

  const [yarn] = await db
    .select()
    .from(stashYarnsTable)
    .where(and(eq(stashYarnsTable.id, params.data.yarnId), eq(stashYarnsTable.ownerId, getOwnerId(res))));
  if (!yarn) {
    res.status(404).json({ error: "Yarn not found." });
    return;
  }
  res.json(serializeStashYarn(yarn));
});

router.patch("/yarn-stash/:yarnId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateStashYarnParams.safeParse(req.params);
  const parsed = UpdateStashYarnBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Check the yarn details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const changes = parsed.data;
  type Outcome = { status: 200; yarn: StashYarn; oldPhoto: string | null } | { status: 400 | 404; error: string };
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const current = await lockedYarn(tx, ownerId, params.data.yarnId);
    if (!current) return { status: 404, error: "Yarn not found." };
    const checked = await checkDetails(ownerId, {
      brand: changes.brand ?? current.brand,
      subBrand: changes.subBrand !== undefined ? changes.subBrand : current.subBrand,
      color: changes.color !== undefined ? changes.color : current.color,
      generalColor: changes.generalColor !== undefined ? changes.generalColor : current.generalColor,
      weight: changes.weight !== undefined ? changes.weight : current.weight,
      blend: changes.blend ?? current.blend,
      brandLink: changes.brandLink !== undefined ? changes.brandLink : current.brandLink,
      photoPath: changes.photoPath ?? current.photoPath ?? "",
      skeinsPurchased: changes.skeinsPurchased !== undefined ? changes.skeinsPurchased : current.skeinsPurchased,
      skeinsLeft: changes.skeinsLeft !== undefined ? changes.skeinsLeft : current.skeinsLeft,
    });
    if (!checked.ok) return { status: 400, error: checked.error };
    const yarn = await writeYarn(tx, ownerId, checked.details, current);
    return yarn ? { status: 200, yarn, oldPhoto: current.photoPath } : { status: 404, error: "Yarn not found." };
  });
  if (outcome.status !== 200) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  if (outcome.yarn.photoPath !== outcome.oldPhoto) await removeStashPhoto(req.log, outcome.oldPhoto);
  res.json(serializeStashYarn(outcome.yarn));
});

router.delete("/yarn-stash/:yarnId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteStashYarnParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid yarn ID." });
    return;
  }

  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(stashYarnsTable)
      .where(and(eq(stashYarnsTable.id, params.data.yarnId), eq(stashYarnsTable.ownerId, getOwnerId(res))))
      .returning();
    if (row) await pruneUnusedCatalog(tx, [row]);
    return row;
  });
  if (!deleted) {
    res.status(404).json({ error: "Yarn not found." });
    return;
  }
  await removeStashPhoto(req.log, deleted.photoPath);
  res.sendStatus(204);
});

router.get("/yarn-stash/:yarnId/photo", requireAuth, async (req, res): Promise<void> => {
  const params = GetStashYarnPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid yarn photo request." });
    return;
  }

  const ownerId = getOwnerId(res);
  const [yarn] = await db
    .select({ photoPath: stashYarnsTable.photoPath })
    .from(stashYarnsTable)
    .where(and(eq(stashYarnsTable.id, params.data.yarnId), eq(stashYarnsTable.ownerId, ownerId)));
  if (!yarn?.photoPath || !isOwnStashPhoto(ownerId, yarn.photoPath)) {
    res.status(404).json({ error: "Yarn photo not found." });
    return;
  }

  try {
    const { bucketName, objectName } = storageLocation(yarn.photoPath.slice("/objects/".length));
    res.redirect(302, await signedObjectUrl(bucketName, objectName, "GET"));
  } catch (error) {
    req.log.error({ err: error, yarnId: params.data.yarnId }, "Could not serve stash photo");
    res.status(500).json({ error: "Could not load the yarn photo." });
  }
});

export default router;
