import { and, asc, eq, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  CreateSewingToolBody,
  DeleteSewingToolParams,
  GetSewingToolParams,
  GetSewingToolPhotoParams,
  GetSewingToolResponse,
  GetSewingToolsQueryParams,
  RequestSewingToolPhotoUploadBody,
  RequestSewingToolPhotoUploadResponse,
  UpdateSewingToolBody,
  UpdateSewingToolParams,
} from "@workspace/api-zod";
import { db, sewingToolsTable, type SewingTool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteStoredObject, signedObjectUrl, storageLocation } from "../lib/objectStorage";
import { categoryFits, isOwnToolPhoto } from "../lib/sewingTools";

const router: IRouter = Router();
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoSize = 10 * 1024 * 1024;

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

function tidyText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

// The stored photo path stays on the server; the app only learns whether
// there is one.
export function serializeTool(tool: SewingTool) {
  const { photoPath, ownerId: _ownerId, ...rest } = tool;
  return GetSewingToolResponse.parse({ ...rest, hasPhoto: photoPath !== null });
}

// The row is already gone or changed, so removing the stored file is
// cleanup: a failure is logged and the request still succeeds.
async function removeToolPhoto(
  log: { error: (details: object, message: string) => void },
  photoPath: string | null,
) {
  if (!photoPath) return;
  try {
    await deleteStoredObject(photoPath.slice("/objects/".length));
  } catch (error) {
    log.error({ err: error, photoPath }, "Could not delete stored tool photo");
  }
}

async function findOwn(ownerId: string, toolId: string) {
  const [tool] = await db
    .select()
    .from(sewingToolsTable)
    .where(and(eq(sewingToolsTable.id, toolId), eq(sewingToolsTable.ownerId, ownerId)));
  return tool;
}

router.get("/sewing-tools", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetSewingToolsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tool filters." });
    return;
  }

  const filters = [eq(sewingToolsTable.ownerId, getOwnerId(res))];
  const search = parsed.data.search?.trim();
  if (search) {
    filters.push(or(
      ilike(sewingToolsTable.name, `%${search}%`),
      ilike(sewingToolsTable.brand, `%${search}%`),
      ilike(sewingToolsTable.size, `%${search}%`),
      ilike(sewingToolsTable.color, `%${search}%`),
      ilike(sewingToolsTable.notes, `%${search}%`),
    )!);
  }
  if (parsed.data.section) filters.push(eq(sewingToolsTable.section, parsed.data.section));
  if (parsed.data.category) filters.push(eq(sewingToolsTable.category, parsed.data.category));

  const rows = await db
    .select()
    .from(sewingToolsTable)
    .where(and(...filters))
    .orderBy(asc(sewingToolsTable.category), asc(sewingToolsTable.name));
  res.json(rows.map(serializeTool));
});

router.post("/sewing-tools/photo-upload", requireAuth, async (req, res): Promise<void> => {
  const parsed = RequestSewingToolPhotoUploadBody.safeParse(req.body);
  if (!parsed.success || !allowedPhotoTypes.has(parsed.data.contentType) || parsed.data.size > maxPhotoSize) {
    res.status(400).json({ error: "Choose a JPEG, PNG, or WebP photo up to 10 MB." });
    return;
  }

  const ownerId = getOwnerId(res);
  try {
    const relativePath = `sewing-tools/${ownerId}/${randomUUID()}`;
    const { bucketName, objectName } = storageLocation(relativePath);
    const uploadURL = await signedObjectUrl(bucketName, objectName, "PUT");
    res.json(RequestSewingToolPhotoUploadResponse.parse({ uploadURL, photoPath: `/objects/${relativePath}` }));
  } catch (error) {
    req.log.error({ err: error, ownerId }, "Could not create tool photo upload URL");
    res.status(500).json({ error: "Could not prepare the photo upload." });
  }
});

router.post("/sewing-tools", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSewingToolBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: "Check the tool details and try again." });
    return;
  }
  const ownerId = getOwnerId(res);
  const tool = parsed.data;
  if (!categoryFits(tool.section, tool.category)) {
    res.status(400).json({ error: "Choose a type that fits this section." });
    return;
  }
  if (tool.photoPath && !isOwnToolPhoto(ownerId, tool.photoPath)) {
    res.status(400).json({ error: "The photo didn't upload. Please add it again." });
    return;
  }

  const [created] = await db
    .insert(sewingToolsTable)
    .values({
      ownerId,
      section: tool.section,
      category: tool.category,
      name: tool.name.trim(),
      quantity: tool.quantity ?? null,
      size: tidyText(tool.size),
      color: tidyText(tool.color),
      brand: tidyText(tool.brand),
      notes: tidyText(tool.notes),
      photoPath: tool.photoPath ?? null,
    })
    .returning();
  res.status(201).json(serializeTool(created!));
});

router.get("/sewing-tools/:sewingToolId", requireAuth, async (req, res): Promise<void> => {
  const params = GetSewingToolParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tool ID." });
    return;
  }
  const tool = await findOwn(getOwnerId(res), params.data.sewingToolId);
  if (!tool) {
    res.status(404).json({ error: "Tool not found." });
    return;
  }
  res.json(serializeTool(tool));
});

router.patch("/sewing-tools/:sewingToolId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSewingToolParams.safeParse(req.params);
  const parsed = UpdateSewingToolBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0 || parsed.data.name?.trim() === "") {
    res.status(400).json({ error: "Check the tool details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const current = await findOwn(ownerId, params.data.sewingToolId);
  if (!current) {
    res.status(404).json({ error: "Tool not found." });
    return;
  }
  const changes = parsed.data;
  const section = changes.section ?? current.section;
  const category = changes.category ?? current.category;
  if (!categoryFits(section, category)) {
    res.status(400).json({ error: "Choose a type that fits this section." });
    return;
  }
  if (changes.photoPath && changes.photoPath !== current.photoPath && !isOwnToolPhoto(ownerId, changes.photoPath)) {
    res.status(400).json({ error: "The photo didn't upload. Please add it again." });
    return;
  }

  const text = (value: string | null | undefined, existing: string | null) =>
    value !== undefined ? tidyText(value) : existing;
  const [updated] = await db
    .update(sewingToolsTable)
    .set({
      section,
      category,
      name: changes.name?.trim() ?? current.name,
      quantity: changes.quantity !== undefined ? changes.quantity : current.quantity,
      size: text(changes.size, current.size),
      color: text(changes.color, current.color),
      brand: text(changes.brand, current.brand),
      notes: text(changes.notes, current.notes),
      photoPath: changes.photoPath !== undefined ? changes.photoPath : current.photoPath,
    })
    .where(and(eq(sewingToolsTable.id, current.id), eq(sewingToolsTable.ownerId, ownerId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Tool not found." });
    return;
  }
  if (current.photoPath !== updated.photoPath) await removeToolPhoto(req.log, current.photoPath);
  res.json(serializeTool(updated));
});

router.delete("/sewing-tools/:sewingToolId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteSewingToolParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tool ID." });
    return;
  }
  const [deleted] = await db
    .delete(sewingToolsTable)
    .where(and(eq(sewingToolsTable.id, params.data.sewingToolId), eq(sewingToolsTable.ownerId, getOwnerId(res))))
    .returning({ photoPath: sewingToolsTable.photoPath });
  if (!deleted) {
    res.status(404).json({ error: "Tool not found." });
    return;
  }
  await removeToolPhoto(req.log, deleted.photoPath);
  res.sendStatus(204);
});

router.get("/sewing-tools/:sewingToolId/photo", requireAuth, async (req, res): Promise<void> => {
  const params = GetSewingToolPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tool photo request." });
    return;
  }
  const tool = await findOwn(getOwnerId(res), params.data.sewingToolId);
  if (!tool?.photoPath) {
    res.status(404).json({ error: "Tool photo not found." });
    return;
  }
  try {
    const { bucketName, objectName } = storageLocation(tool.photoPath.slice("/objects/".length));
    res.redirect(302, await signedObjectUrl(bucketName, objectName, "GET"));
  } catch (error) {
    req.log.error({ err: error, sewingToolId: tool.id }, "Could not serve tool photo");
    res.status(500).json({ error: "Could not load the tool photo." });
  }
});

export default router;
