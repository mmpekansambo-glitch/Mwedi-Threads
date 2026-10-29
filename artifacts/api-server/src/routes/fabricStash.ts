import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  AcceptFabricSuggestionParams,
  CreateStashFabricBody,
  DismissFabricSuggestionParams,
  GetFabricSuggestionsQueryParams,
  GetFabricSuggestionsResponse,
  DeleteStashFabricParams,
  GetStashFabricParams,
  GetStashFabricPhotoParams,
  GetStashFabricResponse,
  GetStashFabricsQueryParams,
  RequestFabricPhotoUploadBody,
  RequestFabricPhotoUploadResponse,
  UpdateStashFabricBody,
  UpdateStashFabricParams,
} from "@workspace/api-zod";
import { db, fabricSuggestionsTable, sewingProjectsTable, stashFabricsTable, type StashFabric } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteStoredObject, signedObjectUrl, storageLocation } from "../lib/objectStorage";
import { amountAfter, checkFabricPhotos, checkFabricSizes, fabricName, fabricTypeSearch } from "../lib/fabricStash";
import { printsLookAlike } from "../lib/printPhoto";

const router: IRouter = Router();
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoSize = 10 * 1024 * 1024;

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

// Stored photo paths stay on the server; the app only learns how many there
// are and asks for each one by its place in the list.
export function serializeFabric(fabric: StashFabric, extra: { restored?: boolean } = {}) {
  const { photoPaths, ownerId: _ownerId, brand: _brand, ...rest } = fabric;
  return GetStashFabricResponse.parse({ ...rest, ...extra, photoCount: photoPaths.length });
}

// Fabric no longer has a brand. A brand saved before then is kept by moving
// it into the notes, the first time the maker's fabric is loaded.
const brandsMoved = new Set<string>();
export async function moveFabricBrandsToNotes(ownerId: string): Promise<void> {
  if (brandsMoved.has(ownerId)) return;
  await db
    .update(stashFabricsTable)
    .set({
      notes: sql`case when nullif(trim(${stashFabricsTable.notes}), '') is null then 'Brand: ' || ${stashFabricsTable.brand}
        else 'Brand: ' || ${stashFabricsTable.brand} || E'\n' || ${stashFabricsTable.notes} end`,
      brand: null,
      updatedAt: sql`${stashFabricsTable.updatedAt}`,
    })
    .where(and(eq(stashFabricsTable.ownerId, ownerId), sql`nullif(trim(${stashFabricsTable.brand}), '') is not null`));
  brandsMoved.add(ownerId);
}

function tidyText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

// The rows are already gone or changed, so removing stored files is cleanup:
// a failure is logged and the request still succeeds.
async function removeFabricPhotos(
  log: { error: (details: object, message: string) => void },
  photoPaths: string[],
) {
  for (const photoPath of photoPaths) {
    try {
      await deleteStoredObject(photoPath.slice("/objects/".length));
    } catch (error) {
      log.error({ err: error, photoPath }, "Could not delete stored fabric photo");
    }
  }
}

router.get("/fabric-stash", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetStashFabricsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid fabric filters." });
    return;
  }

  const ownerId = getOwnerId(res);
  await moveFabricBrandsToNotes(ownerId);
  // zod reads "false" as true, so the raw query decides.
  const archived = req.query.archived === "true";
  const filters = [
    eq(stashFabricsTable.ownerId, ownerId),
    archived ? isNotNull(stashFabricsTable.archivedAt) : isNull(stashFabricsTable.archivedAt),
  ];
  const search = parsed.data.search?.trim();
  if (search) {
    const types = fabricTypeSearch(search);
    filters.push(
      or(
        ilike(stashFabricsTable.notes, `%${search}%`),
        ...(types.length ? [sql`${stashFabricsTable.fabricType}::text = any(${sql.raw(`array[${types.map((type) => `'${type}'`).join(",")}]`)})`] : []),
      )!,
    );
  }
  if (parsed.data.fabricType) filters.push(eq(stashFabricsTable.fabricType, parsed.data.fabricType));
  if (parsed.data.print) filters.push(eq(stashFabricsTable.print, parsed.data.print));
  if (parsed.data.generalColor) filters.push(eq(stashFabricsTable.generalColor, parsed.data.generalColor));

  const rows = await db
    .select()
    .from(stashFabricsTable)
    .where(and(...filters))
    .orderBy(desc(stashFabricsTable.updatedAt));
  res.json(rows.map((row) => serializeFabric(row)));
});

router.post("/fabric-stash/photo-upload", requireAuth, async (req, res): Promise<void> => {
  const parsed = RequestFabricPhotoUploadBody.safeParse(req.body);
  if (!parsed.success || !allowedPhotoTypes.has(parsed.data.contentType) || parsed.data.size > maxPhotoSize) {
    res.status(400).json({ error: "Choose a JPEG, PNG, or WebP photo up to 10 MB." });
    return;
  }

  const ownerId = getOwnerId(res);
  try {
    const relativePath = `fabric/${ownerId}/${randomUUID()}`;
    const { bucketName, objectName } = storageLocation(relativePath);
    const uploadURL = await signedObjectUrl(bucketName, objectName, "PUT");
    res.json(RequestFabricPhotoUploadResponse.parse({ uploadURL, photoPath: `/objects/${relativePath}` }));
  } catch (error) {
    req.log.error({ err: error, ownerId }, "Could not create fabric photo upload URL");
    res.status(500).json({ error: "Could not prepare the photo upload." });
  }
});

router.post("/fabric-stash", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateStashFabricBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the fabric details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const photos = checkFabricPhotos(ownerId, parsed.data.photoPaths, []);
  if (!photos.ok) {
    res.status(400).json({ error: photos.error });
    return;
  }
  const sizes = checkFabricSizes(parsed.data.amount ?? null, parsed.data.width ?? null, parsed.data.amountLeft ?? null);
  if (!sizes.ok) {
    res.status(400).json({ error: sizes.error });
    return;
  }
  const details = {
    fabricType: parsed.data.fabricType,
    construction: parsed.data.construction ?? null,
    print: parsed.data.print ?? null,
    generalColor: parsed.data.generalColor ?? null,
    unit: parsed.data.unit,
    amount: sizes.amount,
    amountLeft: sizes.amountLeft,
    width: sizes.width,
    preWashed: parsed.data.preWashed ?? null,
    notes: tidyText(parsed.data.notes),
    photoPaths: photos.photoPaths,
  };

  // The maker said this is a fabric from their Archive: bring it back with
  // the new details instead of adding a copy.
  if (parsed.data.restoreId) {
    const restoreId = parsed.data.restoreId;
    const outcome = await db.transaction(async (tx) => {
      const [archived] = await tx
        .select()
        .from(stashFabricsTable)
        .where(and(eq(stashFabricsTable.id, restoreId), eq(stashFabricsTable.ownerId, ownerId), isNotNull(stashFabricsTable.archivedAt)))
        .for("update");
      if (!archived) return undefined;
      const [restored] = await tx
        .update(stashFabricsTable)
        .set({ ...details, archivedAt: null })
        .where(eq(stashFabricsTable.id, archived.id))
        .returning();
      return { restored: restored!, oldPhotos: archived.photoPaths };
    });
    if (!outcome) {
      res.status(404).json({ error: "That fabric isn't in your Archive any more." });
      return;
    }
    await removeFabricPhotos(req.log, outcome.oldPhotos.filter((path) => !outcome.restored.photoPaths.includes(path)));
    res.status(200).json(serializeFabric(outcome.restored, { restored: true }));
    return;
  }

  // Fabric is hard to tell apart, so a match needs every detail to agree and
  // the print photos not to clearly differ. The maker has the last word.
  if (!parsed.data.addAsNew) {
    const same = (column: typeof stashFabricsTable.construction | typeof stashFabricsTable.print | typeof stashFabricsTable.generalColor, value: string | null) =>
      sql`${column} is not distinct from ${value}`;
    const candidates = await db
      .select()
      .from(stashFabricsTable)
      .where(and(
        eq(stashFabricsTable.ownerId, ownerId),
        isNotNull(stashFabricsTable.archivedAt),
        eq(stashFabricsTable.fabricType, details.fabricType),
        eq(stashFabricsTable.unit, details.unit),
        same(stashFabricsTable.construction, details.construction),
        same(stashFabricsTable.print, details.print),
        same(stashFabricsTable.generalColor, details.generalColor),
      ))
      .orderBy(desc(stashFabricsTable.archivedAt))
      .limit(3);
    for (const candidate of candidates) {
      const similarPhoto = candidate.photoPaths[0]
        ? await printsLookAlike(details.photoPaths[0]!, candidate.photoPaths[0])
        : null;
      if (similarPhoto === false) continue;
      res.status(409).json({ match: serializeFabric(candidate), similarPhoto });
      return;
    }
  }

  const [created] = await db
    .insert(stashFabricsTable)
    .values({ ownerId, ...details })
    .returning();
  res.status(201).json(serializeFabric(created!));
});

router.get("/fabric-stash/fabric-suggestions", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetFabricSuggestionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }

  const filters = [
    eq(fabricSuggestionsTable.ownerId, getOwnerId(res)),
    eq(fabricSuggestionsTable.status, "pending"),
  ];
  if (parsed.data.projectId) filters.push(eq(fabricSuggestionsTable.projectId, parsed.data.projectId));
  const rows = await db
    .select({
      id: fabricSuggestionsTable.id,
      stashFabricId: fabricSuggestionsTable.stashFabricId,
      projectId: fabricSuggestionsTable.projectId,
      projectTitle: sewingProjectsTable.title,
      amountUsed: fabricSuggestionsTable.amountUsed,
      fabricType: stashFabricsTable.fabricType,
      print: stashFabricsTable.print,
      unit: stashFabricsTable.unit,
      amount: stashFabricsTable.amount,
      amountLeft: stashFabricsTable.amountLeft,
    })
    .from(fabricSuggestionsTable)
    .innerJoin(stashFabricsTable, eq(fabricSuggestionsTable.stashFabricId, stashFabricsTable.id))
    .innerJoin(sewingProjectsTable, eq(fabricSuggestionsTable.projectId, sewingProjectsTable.id))
    .where(and(...filters))
    .orderBy(desc(fabricSuggestionsTable.createdAt));
  // A piece with no amount has nothing to take the fabric off.
  res.json(GetFabricSuggestionsResponse.parse(rows.flatMap((row) => {
    const left = row.amountLeft ?? row.amount;
    if (left === null) return [];
    return [{
      id: row.id,
      stashFabricId: row.stashFabricId,
      projectId: row.projectId,
      projectTitle: row.projectTitle,
      fabricName: fabricName(row),
      unit: row.unit,
      amountUsed: row.amountUsed,
      amountLeft: left,
      suggestedLeft: amountAfter(left, row.amountUsed),
    }];
  })));
});

router.post("/fabric-stash/fabric-suggestions/:suggestionId/accept", requireAuth, async (req, res): Promise<void> => {
  const params = AcceptFabricSuggestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid suggestion ID." });
    return;
  }

  const ownerId = getOwnerId(res);
  const updated = await db.transaction(async (tx) => {
    const [suggestion] = await tx
      .select()
      .from(fabricSuggestionsTable)
      .where(and(
        eq(fabricSuggestionsTable.id, params.data.suggestionId),
        eq(fabricSuggestionsTable.ownerId, ownerId),
        eq(fabricSuggestionsTable.status, "pending"),
      ))
      .for("update");
    if (!suggestion) return undefined;
    const [fabric] = await tx
      .select()
      .from(stashFabricsTable)
      .where(and(eq(stashFabricsTable.id, suggestion.stashFabricId), eq(stashFabricsTable.ownerId, ownerId)))
      .for("update");
    const left = fabric ? fabric.amountLeft ?? fabric.amount : null;
    if (!fabric || left === null) return undefined;
    await tx
      .update(fabricSuggestionsTable)
      .set({ status: "accepted" })
      .where(eq(fabricSuggestionsTable.id, suggestion.id));
    const [saved] = await tx
      .update(stashFabricsTable)
      .set({ amountLeft: amountAfter(left, suggestion.amountUsed) })
      .where(eq(stashFabricsTable.id, fabric.id))
      .returning();
    return saved;
  });
  if (!updated) {
    res.status(404).json({ error: "Suggestion not found." });
    return;
  }
  res.json(serializeFabric(updated));
});

router.post("/fabric-stash/fabric-suggestions/:suggestionId/dismiss", requireAuth, async (req, res): Promise<void> => {
  const params = DismissFabricSuggestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid suggestion ID." });
    return;
  }

  const [dismissed] = await db
    .update(fabricSuggestionsTable)
    .set({ status: "dismissed" })
    .where(and(
      eq(fabricSuggestionsTable.id, params.data.suggestionId),
      eq(fabricSuggestionsTable.ownerId, getOwnerId(res)),
      eq(fabricSuggestionsTable.status, "pending"),
    ))
    .returning({ id: fabricSuggestionsTable.id });
  if (!dismissed) {
    res.status(404).json({ error: "Suggestion not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/fabric-stash/:fabricId", requireAuth, async (req, res): Promise<void> => {
  const params = GetStashFabricParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid fabric ID." });
    return;
  }

  await moveFabricBrandsToNotes(getOwnerId(res));
  const [fabric] = await db
    .select()
    .from(stashFabricsTable)
    .where(and(eq(stashFabricsTable.id, params.data.fabricId), eq(stashFabricsTable.ownerId, getOwnerId(res))));
  if (!fabric) {
    res.status(404).json({ error: "Fabric not found." });
    return;
  }
  res.json(serializeFabric(fabric));
});

router.patch("/fabric-stash/:fabricId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateStashFabricParams.safeParse(req.params);
  const parsed = UpdateStashFabricBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Check the fabric details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  await moveFabricBrandsToNotes(ownerId);
  const changes = parsed.data;
  // The row is locked while the edit is checked and written, so the whole
  // edit lands together or not at all.
  type Outcome = { status: 200; fabric: StashFabric; oldPhotos: string[] } | { status: 400 | 404; error: string };
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const [current] = await tx
      .select()
      .from(stashFabricsTable)
      .where(and(eq(stashFabricsTable.id, params.data.fabricId), eq(stashFabricsTable.ownerId, ownerId)))
      .for("update");
    if (!current) return { status: 404, error: "Fabric not found." };

    const photos = changes.photoPaths
      ? checkFabricPhotos(ownerId, changes.photoPaths, current.photoPaths)
      : { ok: true as const, photoPaths: current.photoPaths };
    if (!photos.ok) return { status: 400, error: photos.error };
    const sizes = checkFabricSizes(
      changes.amount !== undefined ? changes.amount : current.amount,
      changes.width !== undefined ? changes.width : current.width,
      changes.amountLeft !== undefined ? changes.amountLeft : current.amountLeft,
    );
    if (!sizes.ok) return { status: 400, error: sizes.error };

    const [updated] = await tx
      .update(stashFabricsTable)
      .set({
        fabricType: changes.fabricType ?? current.fabricType,
        construction: changes.construction !== undefined ? changes.construction : current.construction,
        print: changes.print !== undefined ? changes.print : current.print,
        generalColor: changes.generalColor !== undefined ? changes.generalColor : current.generalColor,
        unit: changes.unit ?? current.unit,
        amount: sizes.amount,
        amountLeft: sizes.amountLeft,
        width: sizes.width,
        preWashed: changes.preWashed !== undefined ? changes.preWashed : current.preWashed,
        archivedAt: changes.archived === undefined ? current.archivedAt : changes.archived ? current.archivedAt ?? new Date() : null,
        notes: changes.notes !== undefined ? tidyText(changes.notes) : current.notes,
        photoPaths: photos.photoPaths,
      })
      .where(and(eq(stashFabricsTable.id, current.id), eq(stashFabricsTable.ownerId, ownerId)))
      .returning();
    return updated ? { status: 200, fabric: updated, oldPhotos: current.photoPaths } : { status: 404, error: "Fabric not found." };
  });
  if (outcome.status !== 200) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  await removeFabricPhotos(req.log, outcome.oldPhotos.filter((path) => !outcome.fabric.photoPaths.includes(path)));
  res.json(serializeFabric(outcome.fabric));
});

router.delete("/fabric-stash/:fabricId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteStashFabricParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid fabric ID." });
    return;
  }

  const [deleted] = await db
    .delete(stashFabricsTable)
    .where(and(eq(stashFabricsTable.id, params.data.fabricId), eq(stashFabricsTable.ownerId, getOwnerId(res))))
    .returning({ photoPaths: stashFabricsTable.photoPaths });
  if (!deleted) {
    res.status(404).json({ error: "Fabric not found." });
    return;
  }
  await removeFabricPhotos(req.log, deleted.photoPaths);
  res.sendStatus(204);
});

router.get("/fabric-stash/:fabricId/photos/:photoIndex", requireAuth, async (req, res): Promise<void> => {
  const params = GetStashFabricPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid fabric photo request." });
    return;
  }

  const [fabric] = await db
    .select({ photoPaths: stashFabricsTable.photoPaths })
    .from(stashFabricsTable)
    .where(and(eq(stashFabricsTable.id, params.data.fabricId), eq(stashFabricsTable.ownerId, getOwnerId(res))));
  const photoPath = fabric?.photoPaths[params.data.photoIndex];
  if (!photoPath) {
    res.status(404).json({ error: "Fabric photo not found." });
    return;
  }

  try {
    const { bucketName, objectName } = storageLocation(photoPath.slice("/objects/".length));
    res.redirect(302, await signedObjectUrl(bucketName, objectName, "GET"));
  } catch (error) {
    req.log.error({ err: error, fabricId: params.data.fabricId }, "Could not serve fabric photo");
    res.status(500).json({ error: "Could not load the fabric photo." });
  }
});

export default router;
