import { and, asc, count, eq, ilike, inArray, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  CreateSewingPatternBody,
  DeleteSewingPatternParams,
  GetSewingPatternParams,
  GetSewingPatternPhotoParams,
  GetSewingPatternResponse,
  GetSewingPatternsQueryParams,
  RequestSewingPatternPhotoUploadBody,
  RequestSewingPatternPhotoUploadResponse,
  UpdateSewingPatternBody,
  UpdateSewingPatternParams,
} from "@workspace/api-zod";
import { db, sewingPatternsTable, sewingProjectsTable, type SewingPattern } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteStoredObject, signedObjectUrl, storageLocation } from "../lib/objectStorage";
import { isOwnPatternPhoto, moveTypedPatterns } from "../lib/sewingPatterns";

const router: IRouter = Router();
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoSize = 10 * 1024 * 1024;

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

function tidyText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

// How many finished sewing projects used each pattern.
async function timesMade(patternIds: string[]): Promise<Map<string, number>> {
  if (patternIds.length === 0) return new Map();
  const rows = await db
    .select({ patternId: sewingProjectsTable.patternId, made: count() })
    .from(sewingProjectsTable)
    .where(and(inArray(sewingProjectsTable.patternId, patternIds), eq(sewingProjectsTable.status, "completed")))
    .groupBy(sewingProjectsTable.patternId);
  return new Map(rows.map((row) => [row.patternId!, Number(row.made)]));
}

// The stored photo path stays on the server; the app only learns whether
// there is one.
export function serializePattern(pattern: SewingPattern, made = 0) {
  const { photoPath, ownerId: _ownerId, ...rest } = pattern;
  return GetSewingPatternResponse.parse({ ...rest, hasPhoto: photoPath !== null, timesMade: made });
}

async function serializeWithCounts(patterns: SewingPattern[]) {
  const made = await timesMade(patterns.map((pattern) => pattern.id));
  return patterns.map((pattern) => serializePattern(pattern, made.get(pattern.id) ?? 0));
}

// The row is already gone or changed, so removing the stored file is
// cleanup: a failure is logged and the request still succeeds.
async function removePatternPhoto(
  log: { error: (details: object, message: string) => void },
  photoPath: string | null,
) {
  if (!photoPath) return;
  try {
    await deleteStoredObject(photoPath.slice("/objects/".length));
  } catch (error) {
    log.error({ err: error, photoPath }, "Could not delete stored pattern photo");
  }
}

async function findOwn(ownerId: string, patternId: string) {
  const [pattern] = await db
    .select()
    .from(sewingPatternsTable)
    .where(and(eq(sewingPatternsTable.id, patternId), eq(sewingPatternsTable.ownerId, ownerId)));
  return pattern;
}

router.get("/sewing-patterns", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetSewingPatternsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pattern filters." });
    return;
  }
  const ownerId = getOwnerId(res);
  await moveTypedPatterns(ownerId);

  const filters = [eq(sewingPatternsTable.ownerId, ownerId)];
  const search = parsed.data.search?.trim();
  if (search) {
    filters.push(or(
      ilike(sewingPatternsTable.name, `%${search}%`),
      ilike(sewingPatternsTable.designer, `%${search}%`),
      ilike(sewingPatternsTable.sizes, `%${search}%`),
      ilike(sewingPatternsTable.notes, `%${search}%`),
    )!);
  }
  if (parsed.data.patternType) filters.push(eq(sewingPatternsTable.patternType, parsed.data.patternType));
  if (parsed.data.format) filters.push(eq(sewingPatternsTable.format, parsed.data.format));

  const rows = await db
    .select()
    .from(sewingPatternsTable)
    .where(and(...filters))
    .orderBy(asc(sewingPatternsTable.name));
  res.json(await serializeWithCounts(rows));
});

router.post("/sewing-patterns/photo-upload", requireAuth, async (req, res): Promise<void> => {
  const parsed = RequestSewingPatternPhotoUploadBody.safeParse(req.body);
  if (!parsed.success || !allowedPhotoTypes.has(parsed.data.contentType) || parsed.data.size > maxPhotoSize) {
    res.status(400).json({ error: "Choose a JPEG, PNG, or WebP photo up to 10 MB." });
    return;
  }
  const ownerId = getOwnerId(res);
  try {
    const relativePath = `sewing-patterns/${ownerId}/${randomUUID()}`;
    const { bucketName, objectName } = storageLocation(relativePath);
    const uploadURL = await signedObjectUrl(bucketName, objectName, "PUT");
    res.json(RequestSewingPatternPhotoUploadResponse.parse({ uploadURL, photoPath: `/objects/${relativePath}` }));
  } catch (error) {
    req.log.error({ err: error, ownerId }, "Could not create pattern photo upload URL");
    res.status(500).json({ error: "Could not prepare the photo upload." });
  }
});

router.post("/sewing-patterns", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSewingPatternBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: "Check the pattern details and try again." });
    return;
  }
  const ownerId = getOwnerId(res);
  const pattern = parsed.data;
  if (pattern.photoPath && !isOwnPatternPhoto(ownerId, pattern.photoPath)) {
    res.status(400).json({ error: "The photo didn't upload. Please add it again." });
    return;
  }
  const [created] = await db
    .insert(sewingPatternsTable)
    .values({
      ownerId,
      name: pattern.name.trim(),
      designer: tidyText(pattern.designer),
      patternType: pattern.patternType ?? null,
      format: pattern.format ?? null,
      sizes: tidyText(pattern.sizes),
      notes: tidyText(pattern.notes),
      photoPath: pattern.photoPath ?? null,
    })
    .returning();
  res.status(201).json(serializePattern(created!));
});

router.get("/sewing-patterns/:sewingPatternId", requireAuth, async (req, res): Promise<void> => {
  const params = GetSewingPatternParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid pattern ID." });
    return;
  }
  const pattern = await findOwn(getOwnerId(res), params.data.sewingPatternId);
  if (!pattern) {
    res.status(404).json({ error: "Pattern not found." });
    return;
  }
  res.json((await serializeWithCounts([pattern]))[0]);
});

router.patch("/sewing-patterns/:sewingPatternId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSewingPatternParams.safeParse(req.params);
  const parsed = UpdateSewingPatternBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0 || parsed.data.name?.trim() === "") {
    res.status(400).json({ error: "Check the pattern details and try again." });
    return;
  }
  const ownerId = getOwnerId(res);
  type Outcome = { status: 200; pattern: SewingPattern; oldPhoto: string | null } | { status: 400 | 404; error: string };
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const [current] = await tx
      .select()
      .from(sewingPatternsTable)
      .where(and(eq(sewingPatternsTable.id, params.data.sewingPatternId), eq(sewingPatternsTable.ownerId, ownerId)))
      .for("update");
    if (!current) return { status: 404, error: "Pattern not found." };
    const changes = parsed.data;
    if (changes.photoPath && changes.photoPath !== current.photoPath && !isOwnPatternPhoto(ownerId, changes.photoPath)) {
      return { status: 400, error: "The photo didn't upload. Please add it again." };
    }
    const text = (value: string | null | undefined, existing: string | null) =>
      value !== undefined ? tidyText(value) : existing;
    const [updated] = await tx
      .update(sewingPatternsTable)
      .set({
        name: changes.name?.trim() ?? current.name,
        designer: text(changes.designer, current.designer),
        patternType: changes.patternType !== undefined ? changes.patternType : current.patternType,
        format: changes.format !== undefined ? changes.format : current.format,
        sizes: text(changes.sizes, current.sizes),
        notes: text(changes.notes, current.notes),
        photoPath: changes.photoPath !== undefined ? changes.photoPath : current.photoPath,
      })
      .where(and(eq(sewingPatternsTable.id, current.id), eq(sewingPatternsTable.ownerId, ownerId)))
      .returning();
    return updated ? { status: 200, pattern: updated, oldPhoto: current.photoPath } : { status: 404, error: "Pattern not found." };
  });
  if (outcome.status !== 200) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  if (outcome.oldPhoto !== outcome.pattern.photoPath) await removePatternPhoto(req.log, outcome.oldPhoto);
  res.json((await serializeWithCounts([outcome.pattern]))[0]);
});

router.delete("/sewing-patterns/:sewingPatternId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteSewingPatternParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid pattern ID." });
    return;
  }
  const [deleted] = await db
    .delete(sewingPatternsTable)
    .where(and(eq(sewingPatternsTable.id, params.data.sewingPatternId), eq(sewingPatternsTable.ownerId, getOwnerId(res))))
    .returning({ photoPath: sewingPatternsTable.photoPath });
  if (!deleted) {
    res.status(404).json({ error: "Pattern not found." });
    return;
  }
  await removePatternPhoto(req.log, deleted.photoPath);
  res.sendStatus(204);
});

router.get("/sewing-patterns/:sewingPatternId/photo", requireAuth, async (req, res): Promise<void> => {
  const params = GetSewingPatternPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid pattern photo request." });
    return;
  }
  const pattern = await findOwn(getOwnerId(res), params.data.sewingPatternId);
  if (!pattern?.photoPath) {
    res.status(404).json({ error: "Pattern photo not found." });
    return;
  }
  try {
    const { bucketName, objectName } = storageLocation(pattern.photoPath.slice("/objects/".length));
    res.redirect(302, await signedObjectUrl(bucketName, objectName, "GET"));
  } catch (error) {
    req.log.error({ err: error, sewingPatternId: pattern.id }, "Could not serve pattern photo");
    res.status(500).json({ error: "Could not load the pattern photo." });
  }
});

export default router;
