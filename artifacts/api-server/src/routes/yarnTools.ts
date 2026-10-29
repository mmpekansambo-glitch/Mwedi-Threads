import { and, asc, eq, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  CreateYarnToolBody,
  DeleteYarnToolParams,
  GetYarnToolParams,
  GetYarnToolPhotoParams,
  GetYarnToolResponse,
  GetYarnToolsQueryParams,
  RequestYarnToolPhotoUploadBody,
  RequestYarnToolPhotoUploadResponse,
  UpdateYarnToolBody,
  UpdateYarnToolParams,
} from "@workspace/api-zod";
import { db, yarnToolsTable, type YarnTool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteStoredObject, signedObjectUrl, storageLocation } from "../lib/objectStorage";
import { isOwnYarnToolPhoto, shapeYarnTool, type YarnToolFields } from "../lib/yarnTools";

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
function serializeTool(tool: YarnTool) {
  const { photoPath, ownerId: _ownerId, ...rest } = tool;
  return GetYarnToolResponse.parse({ ...rest, hasPhoto: photoPath !== null });
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
    log.error({ err: error, photoPath }, "Could not delete stored yarn tool photo");
  }
}

async function findOwn(ownerId: string, toolId: string) {
  const [tool] = await db
    .select()
    .from(yarnToolsTable)
    .where(and(eq(yarnToolsTable.id, toolId), eq(yarnToolsTable.ownerId, ownerId)));
  return tool;
}

router.get("/yarn-tools", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetYarnToolsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tool filters." });
    return;
  }

  const filters = [eq(yarnToolsTable.ownerId, getOwnerId(res))];
  const search = parsed.data.search?.trim();
  if (search) {
    filters.push(or(
      ilike(yarnToolsTable.size, `%${search}%`),
      ilike(yarnToolsTable.name, `%${search}%`),
      ilike(yarnToolsTable.brand, `%${search}%`),
      ilike(yarnToolsTable.notes, `%${search}%`),
    )!);
  }
  if (parsed.data.section) filters.push(eq(yarnToolsTable.section, parsed.data.section));

  const rows = await db
    .select()
    .from(yarnToolsTable)
    .where(and(...filters))
    .orderBy(asc(yarnToolsTable.createdAt));
  res.json(rows.map(serializeTool));
});

router.post("/yarn-tools/photo-upload", requireAuth, async (req, res): Promise<void> => {
  const parsed = RequestYarnToolPhotoUploadBody.safeParse(req.body);
  if (!parsed.success || !allowedPhotoTypes.has(parsed.data.contentType) || parsed.data.size > maxPhotoSize) {
    res.status(400).json({ error: "Choose a JPEG, PNG, or WebP photo up to 10 MB." });
    return;
  }

  const ownerId = getOwnerId(res);
  try {
    const relativePath = `yarn-tools/${ownerId}/${randomUUID()}`;
    const { bucketName, objectName } = storageLocation(relativePath);
    const uploadURL = await signedObjectUrl(bucketName, objectName, "PUT");
    res.json(RequestYarnToolPhotoUploadResponse.parse({ uploadURL, photoPath: `/objects/${relativePath}` }));
  } catch (error) {
    req.log.error({ err: error, ownerId }, "Could not create yarn tool photo upload URL");
    res.status(500).json({ error: "Could not prepare the photo upload." });
  }
});

router.post("/yarn-tools", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateYarnToolBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the tool details and try again." });
    return;
  }
  const ownerId = getOwnerId(res);
  const tool = parsed.data;
  const shaped = shapeYarnTool({
    section: tool.section,
    size: tool.size ?? null,
    needleType: tool.needleType ?? null,
    cableLength: tool.cableLength ?? null,
    material: tool.material ?? null,
    notionType: tool.notionType ?? null,
  });
  if (typeof shaped === "string") {
    res.status(400).json({ error: shaped });
    return;
  }
  if (tool.photoPath && !isOwnYarnToolPhoto(ownerId, tool.photoPath)) {
    res.status(400).json({ error: "The photo didn't upload. Please add it again." });
    return;
  }

  const [created] = await db
    .insert(yarnToolsTable)
    .values({
      ownerId,
      ...shapedColumns(shaped),
      name: tidyText(tool.name),
      quantity: tool.quantity ?? null,
      brand: tidyText(tool.brand),
      notes: tidyText(tool.notes),
      photoPath: tool.photoPath ?? null,
    })
    .returning();
  res.status(201).json(serializeTool(created!));
});

// The shaped fields were checked against the generated enums, so they can go
// straight into the enum columns.
function shapedColumns(fields: YarnToolFields) {
  return {
    section: fields.section,
    size: fields.size,
    needleType: fields.needleType,
    cableLength: fields.cableLength,
    material: fields.material as YarnTool["material"],
    notionType: fields.notionType as YarnTool["notionType"],
  };
}

router.get("/yarn-tools/:yarnToolId", requireAuth, async (req, res): Promise<void> => {
  const params = GetYarnToolParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tool ID." });
    return;
  }
  const tool = await findOwn(getOwnerId(res), params.data.yarnToolId);
  if (!tool) {
    res.status(404).json({ error: "Tool not found." });
    return;
  }
  res.json(serializeTool(tool));
});

router.patch("/yarn-tools/:yarnToolId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateYarnToolParams.safeParse(req.params);
  const parsed = UpdateYarnToolBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Check the tool details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  // The row is locked while the edit is checked and written, so the whole
  // edit lands together or not at all.
  type Outcome = { status: 200; tool: YarnTool; oldPhoto: string | null } | { status: 400 | 404; error: string };
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const [current] = await tx
      .select()
      .from(yarnToolsTable)
      .where(and(eq(yarnToolsTable.id, params.data.yarnToolId), eq(yarnToolsTable.ownerId, ownerId)))
      .for("update");
    if (!current) return { status: 404, error: "Tool not found." };
    const changes = parsed.data;
    const pick = <T>(value: T | undefined, existing: T) => (value !== undefined ? value : existing);
    const shaped = shapeYarnTool({
      section: changes.section ?? current.section,
      size: pick(changes.size, current.size),
      needleType: pick(changes.needleType, current.needleType),
      cableLength: pick(changes.cableLength, current.cableLength),
      material: pick(changes.material, current.material),
      notionType: pick(changes.notionType, current.notionType),
    });
    if (typeof shaped === "string") return { status: 400, error: shaped };
    if (changes.photoPath && changes.photoPath !== current.photoPath && !isOwnYarnToolPhoto(ownerId, changes.photoPath)) {
      return { status: 400, error: "The photo didn't upload. Please add it again." };
    }

    const text = (value: string | null | undefined, existing: string | null) =>
      value !== undefined ? tidyText(value) : existing;
    const [updated] = await tx
      .update(yarnToolsTable)
      .set({
        ...shapedColumns(shaped),
        name: text(changes.name, current.name),
        quantity: pick(changes.quantity, current.quantity),
        brand: text(changes.brand, current.brand),
        notes: text(changes.notes, current.notes),
        photoPath: pick(changes.photoPath, current.photoPath),
      })
      .where(and(eq(yarnToolsTable.id, current.id), eq(yarnToolsTable.ownerId, ownerId)))
      .returning();
    return updated ? { status: 200, tool: updated, oldPhoto: current.photoPath } : { status: 404, error: "Tool not found." };
  });
  if (outcome.status !== 200) {
    res.status(outcome.status).json({ error: outcome.error });
    return;
  }
  if (outcome.oldPhoto !== outcome.tool.photoPath) await removeToolPhoto(req.log, outcome.oldPhoto);
  res.json(serializeTool(outcome.tool));
});

router.delete("/yarn-tools/:yarnToolId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteYarnToolParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tool ID." });
    return;
  }
  const [deleted] = await db
    .delete(yarnToolsTable)
    .where(and(eq(yarnToolsTable.id, params.data.yarnToolId), eq(yarnToolsTable.ownerId, getOwnerId(res))))
    .returning({ photoPath: yarnToolsTable.photoPath });
  if (!deleted) {
    res.status(404).json({ error: "Tool not found." });
    return;
  }
  await removeToolPhoto(req.log, deleted.photoPath);
  res.sendStatus(204);
});

router.get("/yarn-tools/:yarnToolId/photo", requireAuth, async (req, res): Promise<void> => {
  const params = GetYarnToolPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid tool photo request." });
    return;
  }
  const tool = await findOwn(getOwnerId(res), params.data.yarnToolId);
  if (!tool?.photoPath) {
    res.status(404).json({ error: "Tool photo not found." });
    return;
  }
  try {
    const { bucketName, objectName } = storageLocation(tool.photoPath.slice("/objects/".length));
    res.redirect(302, await signedObjectUrl(bucketName, objectName, "GET"));
  } catch (error) {
    req.log.error({ err: error, yarnToolId: tool.id }, "Could not serve yarn tool photo");
    res.status(500).json({ error: "Could not load the yarn tool photo." });
  }
});

export default router;
