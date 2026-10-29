import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  CreateStashFabricBody,
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
import { db, stashFabricsTable, type StashFabric } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteStoredObject, signedObjectUrl, storageLocation } from "../lib/objectStorage";
import { checkFabricPhotos, checkFabricSizes, fabricTypeSearch } from "../lib/fabricStash";

const router: IRouter = Router();
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoSize = 10 * 1024 * 1024;

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

// Stored photo paths stay on the server; the app only learns how many there
// are and asks for each one by its place in the list.
export function serializeFabric(fabric: StashFabric) {
  const { photoPaths, ownerId: _ownerId, ...rest } = fabric;
  return GetStashFabricResponse.parse({ ...rest, photoCount: photoPaths.length });
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

  const filters = [eq(stashFabricsTable.ownerId, getOwnerId(res))];
  const search = parsed.data.search?.trim();
  if (search) {
    const types = fabricTypeSearch(search);
    filters.push(
      or(
        ilike(stashFabricsTable.brand, `%${search}%`),
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
  res.json(rows.map(serializeFabric));
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
  const sizes = checkFabricSizes(parsed.data.amount ?? null, parsed.data.width ?? null);
  if (!sizes.ok) {
    res.status(400).json({ error: sizes.error });
    return;
  }

  const [created] = await db
    .insert(stashFabricsTable)
    .values({
      ownerId,
      fabricType: parsed.data.fabricType,
      construction: parsed.data.construction ?? null,
      print: parsed.data.print ?? null,
      generalColor: parsed.data.generalColor ?? null,
      unit: parsed.data.unit,
      amount: sizes.amount,
      width: sizes.width,
      preWashed: parsed.data.preWashed ?? null,
      brand: tidyText(parsed.data.brand),
      notes: tidyText(parsed.data.notes),
      photoPaths: photos.photoPaths,
    })
    .returning();
  res.status(201).json(serializeFabric(created!));
});

router.get("/fabric-stash/:fabricId", requireAuth, async (req, res): Promise<void> => {
  const params = GetStashFabricParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid fabric ID." });
    return;
  }

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
  const [current] = await db
    .select()
    .from(stashFabricsTable)
    .where(and(eq(stashFabricsTable.id, params.data.fabricId), eq(stashFabricsTable.ownerId, ownerId)));
  if (!current) {
    res.status(404).json({ error: "Fabric not found." });
    return;
  }

  const changes = parsed.data;
  const photos = changes.photoPaths
    ? checkFabricPhotos(ownerId, changes.photoPaths, current.photoPaths)
    : { ok: true as const, photoPaths: current.photoPaths };
  if (!photos.ok) {
    res.status(400).json({ error: photos.error });
    return;
  }
  const sizes = checkFabricSizes(
    changes.amount !== undefined ? changes.amount : current.amount,
    changes.width !== undefined ? changes.width : current.width,
  );
  if (!sizes.ok) {
    res.status(400).json({ error: sizes.error });
    return;
  }

  const [updated] = await db
    .update(stashFabricsTable)
    .set({
      fabricType: changes.fabricType ?? current.fabricType,
      construction: changes.construction !== undefined ? changes.construction : current.construction,
      print: changes.print !== undefined ? changes.print : current.print,
      generalColor: changes.generalColor !== undefined ? changes.generalColor : current.generalColor,
      unit: changes.unit ?? current.unit,
      amount: sizes.amount,
      width: sizes.width,
      preWashed: changes.preWashed !== undefined ? changes.preWashed : current.preWashed,
      brand: changes.brand !== undefined ? tidyText(changes.brand) : current.brand,
      notes: changes.notes !== undefined ? tidyText(changes.notes) : current.notes,
      photoPaths: photos.photoPaths,
    })
    .where(and(eq(stashFabricsTable.id, current.id), eq(stashFabricsTable.ownerId, ownerId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Fabric not found." });
    return;
  }
  await removeFabricPhotos(req.log, current.photoPaths.filter((path) => !updated.photoPaths.includes(path)));
  res.json(serializeFabric(updated));
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
