import { and, asc, desc, eq, ilike, like, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  CreateStashYarnBody,
  DeleteStashYarnParams,
  GetStashYarnParams,
  GetStashYarnPhotoParams,
  GetStashYarnResponse,
  GetStashYarnsQueryParams,
  GetYarnCatalogQueryParams,
  GetYarnCatalogResponse,
  RequestStashPhotoUploadBody,
  RequestStashPhotoUploadResponse,
  UpdateStashYarnBody,
  UpdateStashYarnParams,
} from "@workspace/api-zod";
import {
  db,
  stashYarnsTable,
  yarnBrandsTable,
  yarnColorsTable,
  yarnLinesTable,
  type StashYarn,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteStoredObject, signedObjectUrl, storageLocation } from "../lib/objectStorage";
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

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type GeneralColor = NonNullable<StashYarn["generalColor"]>;

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

type CatalogInput = {
  brand: string;
  subBrand: string | null;
  color: string | null;
  generalColor: GeneralColor | null;
  blend: BlendPart[];
  brandLink: string | null;
};

// Adds the yarn's brand, sub brand and color to the shared catalog, or finds
// the entries that already match, and returns the catalog's own spelling.
// The first maker to add a sub brand or color sets its blend, link and
// general color; later makers only fill in what is still missing.
async function addToCatalog(tx: Transaction, input: CatalogInput) {
  const brandName = tidyName(input.brand);
  await tx
    .insert(yarnBrandsTable)
    .values({ name: brandName, matchKey: matchKey(brandName) })
    .onConflictDoNothing({ target: yarnBrandsTable.matchKey });
  const [brand] = await tx
    .select()
    .from(yarnBrandsTable)
    .where(eq(yarnBrandsTable.matchKey, matchKey(brandName)));

  const lineName = input.subBrand ? tidyName(input.subBrand) : "";
  let line: typeof yarnLinesTable.$inferSelect | undefined;
  if (matchKey(lineName)) {
    await tx
      .insert(yarnLinesTable)
      .values({
        brandId: brand.id,
        name: lineName,
        matchKey: matchKey(lineName),
        blend: input.blend,
        link: input.brandLink,
      })
      .onConflictDoNothing({ target: [yarnLinesTable.brandId, yarnLinesTable.matchKey] });
    [line] = await tx
      .select()
      .from(yarnLinesTable)
      .where(and(eq(yarnLinesTable.brandId, brand.id), eq(yarnLinesTable.matchKey, matchKey(lineName))));
    const missing = {
      ...(line.blend.length === 0 && input.blend.length ? { blend: input.blend } : {}),
      ...(!line.link && input.brandLink ? { link: input.brandLink } : {}),
    };
    if (Object.keys(missing).length) {
      [line] = await tx.update(yarnLinesTable).set(missing).where(eq(yarnLinesTable.id, line.id)).returning();
    }
  }

  const colorName = input.color ? tidyName(input.color) : "";
  let color: typeof yarnColorsTable.$inferSelect | undefined;
  if (line && matchKey(colorName)) {
    await tx
      .insert(yarnColorsTable)
      .values({
        lineId: line.id,
        name: colorName,
        matchKey: matchKey(colorName),
        generalColor: input.generalColor,
      })
      .onConflictDoNothing({ target: [yarnColorsTable.lineId, yarnColorsTable.matchKey] });
    [color] = await tx
      .select()
      .from(yarnColorsTable)
      .where(and(eq(yarnColorsTable.lineId, line.id), eq(yarnColorsTable.matchKey, matchKey(colorName))));
    if (!color.generalColor && input.generalColor) {
      [color] = await tx
        .update(yarnColorsTable)
        .set({ generalColor: input.generalColor })
        .where(eq(yarnColorsTable.id, color.id))
        .returning();
    }
  }

  return {
    brandId: brand.id,
    brand: brand.name,
    lineId: line?.id ?? null,
    subBrand: line?.name ?? null,
    colorId: color?.id ?? null,
    color: color?.name ?? (matchKey(colorName) ? colorName : null),
  };
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

async function saveYarn(
  ownerId: string,
  details: YarnDetails,
  yarnId?: string,
): Promise<StashYarn | undefined> {
  return db.transaction(async (tx) => {
    const catalog = await addToCatalog(tx, details);
    const values = {
      ...catalog,
      generalColor: details.generalColor,
      weight: details.weight,
      blend: details.blend,
      brandLink: details.brandLink,
      photoPath: details.photoPath,
      skeinsPurchased: details.skeinsPurchased,
      skeinsLeft: details.skeinsLeft,
    };
    if (!yarnId) {
      const [created] = await tx.insert(stashYarnsTable).values({ ...values, ownerId }).returning();
      return created;
    }
    const [updated] = await tx
      .update(stashYarnsTable)
      .set(values)
      .where(and(eq(stashYarnsTable.id, yarnId), eq(stashYarnsTable.ownerId, ownerId)))
      .returning();
    return updated;
  });
}

// The database row is already gone or changed, so removing the stored file
// is cleanup: a failure is logged and the request still succeeds.
async function removeStashPhoto(
  log: { error: (details: object, message: string) => void },
  photoPath: string,
) {
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

  const created = await saveYarn(ownerId, checked.details);
  res.status(201).json(serializeStashYarn(created!));
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
  const [current] = await db
    .select()
    .from(stashYarnsTable)
    .where(and(eq(stashYarnsTable.id, params.data.yarnId), eq(stashYarnsTable.ownerId, ownerId)));
  if (!current) {
    res.status(404).json({ error: "Yarn not found." });
    return;
  }

  const changes = parsed.data;
  const checked = await checkDetails(ownerId, {
    brand: changes.brand ?? current.brand,
    subBrand: changes.subBrand !== undefined ? changes.subBrand : current.subBrand,
    color: changes.color !== undefined ? changes.color : current.color,
    generalColor: changes.generalColor !== undefined ? changes.generalColor : current.generalColor,
    weight: changes.weight !== undefined ? changes.weight : current.weight,
    blend: changes.blend ?? current.blend,
    brandLink: changes.brandLink !== undefined ? changes.brandLink : current.brandLink,
    photoPath: changes.photoPath ?? current.photoPath,
    skeinsPurchased: changes.skeinsPurchased !== undefined ? changes.skeinsPurchased : current.skeinsPurchased,
    skeinsLeft: changes.skeinsLeft !== undefined ? changes.skeinsLeft : current.skeinsLeft,
  });
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }

  const updated = await saveYarn(ownerId, checked.details, current.id);
  if (!updated) {
    res.status(404).json({ error: "Yarn not found." });
    return;
  }
  if (updated.photoPath !== current.photoPath) await removeStashPhoto(req.log, current.photoPath);
  res.json(serializeStashYarn(updated));
});

router.delete("/yarn-stash/:yarnId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteStashYarnParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid yarn ID." });
    return;
  }

  const [deleted] = await db
    .delete(stashYarnsTable)
    .where(and(eq(stashYarnsTable.id, params.data.yarnId), eq(stashYarnsTable.ownerId, getOwnerId(res))))
    .returning({ photoPath: stashYarnsTable.photoPath });
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
  if (!yarn || !isOwnStashPhoto(ownerId, yarn.photoPath)) {
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
