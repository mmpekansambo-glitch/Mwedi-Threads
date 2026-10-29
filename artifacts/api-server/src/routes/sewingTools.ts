import { and, asc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  CreateSewingToolBody,
  DeleteSewingToolParams,
  GetSewingToolParams,
  GetSewingToolPhotoParams,
  GetSewingToolResponse,
  GetSewingToolsQueryParams,
  RenameSewingToolBrandsBody,
  RequestSewingToolPhotoUploadBody,
  RequestSewingToolPhotoUploadResponse,
  UpdateSewingToolBody,
  UpdateSewingToolParams,
} from "@workspace/api-zod";
import { db, sewingToolsTable, type SewingTool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteStoredObject, signedObjectUrl, storageLocation } from "../lib/objectStorage";
import { categoryFits, isOwnToolPhoto } from "../lib/sewingTools";
import { matchKey } from "../lib/yarnCatalog";

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

  // zod reads "false" as true, so the raw query decides.
  const archived = req.query.archived === "true";
  const filters = [
    eq(sewingToolsTable.ownerId, getOwnerId(res)),
    archived ? isNotNull(sewingToolsTable.archivedAt) : isNull(sewingToolsTable.archivedAt),
  ];
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

// After a brand is renamed on one tool, the maker can rename it on the rest.
router.post("/sewing-tools/rename-brand", requireAuth, async (req, res): Promise<void> => {
  const parsed = RenameSewingToolBrandsBody.safeParse(req.body);
  const to = parsed.success ? parsed.data.to.trim() : "";
  if (!parsed.success || !matchKey(parsed.data.from) || !to) {
    res.status(400).json({ error: "Check the names and try again." });
    return;
  }
  const ownerId = getOwnerId(res);
  const fromKey = matchKey(parsed.data.from);
  const renamed = await db.transaction(async (tx) => {
    const tools = await tx
      .select({ id: sewingToolsTable.id, brand: sewingToolsTable.brand })
      .from(sewingToolsTable)
      .where(and(eq(sewingToolsTable.ownerId, ownerId), isNotNull(sewingToolsTable.brand)))
      .for("update");
    const ids = tools.filter((tool) => matchKey(tool.brand ?? "") === fromKey && tool.brand !== to).map((tool) => tool.id);
    for (const id of ids) {
      await tx.update(sewingToolsTable).set({ brand: to }).where(eq(sewingToolsTable.id, id));
    }
    return ids.length;
  });
  res.json({ renamed });
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
  // The row is locked while the edit is checked and written, so the whole
  // edit lands together or not at all.
  type Outcome = { status: 200; tool: SewingTool; oldPhoto: string | null } | { status: 400 | 404; error: string };
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const [current] = await tx
      .select()
      .from(sewingToolsTable)
      .where(and(eq(sewingToolsTable.id, params.data.sewingToolId), eq(sewingToolsTable.ownerId, ownerId)))
      .for("update");
    if (!current) return { status: 404, error: "Tool not found." };
    const changes = parsed.data;
    const section = changes.section ?? current.section;
    const category = changes.category ?? current.category;
    if (!categoryFits(section, category)) {
      return { status: 400, error: "Choose a type that fits this section." };
    }
    if (changes.photoPath && changes.photoPath !== current.photoPath && !isOwnToolPhoto(ownerId, changes.photoPath)) {
      return { status: 400, error: "The photo didn't upload. Please add it again." };
    }
    // Only notions get used up, so kit never goes in the Archive.
    if (changes.archived && section !== "notions") {
      return { status: 400, error: "Only notions can go in the Archive." };
    }
    const archivedAt = section !== "notions" || changes.archived === false
      ? null
      : changes.archived ? current.archivedAt ?? new Date() : current.archivedAt;

    const text = (value: string | null | undefined, existing: string | null) =>
      value !== undefined ? tidyText(value) : existing;
    const [updated] = await tx
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
        archivedAt,
      })
      .where(and(eq(sewingToolsTable.id, current.id), eq(sewingToolsTable.ownerId, ownerId)))
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
