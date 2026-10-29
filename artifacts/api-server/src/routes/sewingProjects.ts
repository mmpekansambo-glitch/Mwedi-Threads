import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  AddSewingProjectEntryBody,
  AddSewingProjectEntryParams,
  CreateSewingProjectBody,
  DeleteSewingProjectEntryParams,
  DeleteSewingProjectParams,
  GetSewingOverviewResponse,
  GetSewingProjectParams,
  GetSewingProjectResponse,
  GetSewingProjectsQueryParams,
  UpdateSewingProjectBody,
  UpdateSewingProjectEntryBody,
  UpdateSewingProjectEntryParams,
  UpdateSewingProjectParams,
} from "@workspace/api-zod";
import {
  db,
  sewingProjectEntriesTable,
  sewingProjectFabricsTable,
  sewingProjectMachineSettingsTable,
  sewingProjectToolsTable,
  sewingPresserFootEnum,
  sewingProjectsTable,
  sewingStitchEnum,
  sewingToolsTable,
  stashFabricsTable,
  type SewingProject,
  type SewingProjectEntry,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { checkFabricLinks, checkMachineSettings, checkToolIds, fabricTypeCounts, sewingStages, stashLength, statusChanges, type MachineSetting } from "../lib/sewingProjects";
import { serializeFabric } from "./fabricStash";
import { serializeTool } from "./sewingTools";

const router: IRouter = Router();

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

function tidyText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function serializeEntry(entry: SewingProjectEntry) {
  const { projectId: _projectId, ...rest } = entry;
  return rest;
}

// A day of leeway so a maker ahead of the server's clock can still pick today.
function inFuture(date: Date | undefined): boolean {
  return !!date && date.getTime() > Date.now() + 24 * 60 * 60 * 1000;
}

// Adds each project's stash fabric, tools, machine settings and notes, in the order the maker
// listed them (notes newest first).
async function withFabrics(projects: SewingProject[]) {
  const ids = projects.map((project) => project.id);
  const entries = ids.length
    ? await db
        .select()
        .from(sewingProjectEntriesTable)
        .where(inArray(sewingProjectEntriesTable.projectId, ids))
        .orderBy(desc(sewingProjectEntriesTable.createdAt))
    : [];
  const tools = ids.length
    ? await db
        .select({ projectId: sewingProjectToolsTable.projectId, tool: sewingToolsTable })
        .from(sewingProjectToolsTable)
        .innerJoin(sewingToolsTable, eq(sewingToolsTable.id, sewingProjectToolsTable.sewingToolId))
        .where(inArray(sewingProjectToolsTable.projectId, ids))
        .orderBy(asc(sewingProjectToolsTable.position))
    : [];
  const settings = ids.length
    ? await db
        .select()
        .from(sewingProjectMachineSettingsTable)
        .where(inArray(sewingProjectMachineSettingsTable.projectId, ids))
        .orderBy(asc(sewingProjectMachineSettingsTable.position))
    : [];
  const links = ids.length
    ? await db
        .select({ link: sewingProjectFabricsTable, fabric: stashFabricsTable })
        .from(sewingProjectFabricsTable)
        .innerJoin(stashFabricsTable, eq(stashFabricsTable.id, sewingProjectFabricsTable.stashFabricId))
        .where(inArray(sewingProjectFabricsTable.projectId, ids))
        .orderBy(asc(sewingProjectFabricsTable.position))
    : [];
  return projects.map((project) => {
    const { ownerId: _ownerId, ...rest } = project;
    const parsed = GetSewingProjectResponse.parse({
      ...rest,
      fabrics: links
        .filter(({ link }) => link.projectId === project.id)
        .map(({ link, fabric }) => ({
          stashFabricId: link.stashFabricId,
          amountUsed: link.amountUsed,
          fabric: serializeFabric(fabric),
        })),
      tools: tools.filter((row) => row.projectId === project.id).map((row) => serializeTool(row.tool)),
      machineSettings: settings
        .filter((setting) => setting.projectId === project.id)
        .map(({ id: _id, projectId: _projectId, position: _position, ...setting }) => setting),
      entries: entries.filter((entry) => entry.projectId === project.id).map(serializeEntry),
    });
    // The schema reads dates as Date; send the plain YYYY-MM-DD date back.
    return { ...parsed, completedAt: project.completedAt };
  });
}

type LinksResult = { ok: true; links: { stashFabricId: string; amountUsed: number | null }[] } | { ok: false; error: string };

// A project can only use fabric from its owner's own stash.
async function checkLinks(ownerId: string, sent: { stashFabricId: string; amountUsed?: number | null }[]): Promise<LinksResult> {
  const checked = checkFabricLinks(sent);
  if (!checked.ok || checked.links.length === 0) return checked;
  const owned = await db
    .select({ id: stashFabricsTable.id })
    .from(stashFabricsTable)
    .where(and(
      eq(stashFabricsTable.ownerId, ownerId),
      inArray(stashFabricsTable.id, checked.links.map((link) => link.stashFabricId)),
    ));
  if (owned.length !== checked.links.length) return { ok: false, error: "Choose fabric from your stash." };
  return checked;
}

type ToolsResult = { ok: true; ids: string[] } | { ok: false; error: string };

// A project can only list tools from its owner's own Sewing room.
async function checkTools(ownerId: string, sent: string[]): Promise<ToolsResult> {
  const checked = checkToolIds(sent);
  if (!checked.ok || checked.ids.length === 0) return checked;
  const owned = await db
    .select({ id: sewingToolsTable.id })
    .from(sewingToolsTable)
    .where(and(eq(sewingToolsTable.ownerId, ownerId), inArray(sewingToolsTable.id, checked.ids)));
  if (owned.length !== checked.ids.length) return { ok: false, error: "Choose tools from your Sewing room." };
  return checked;
}

async function saveTools(projectId: string, toolIds: string[]) {
  await db.delete(sewingProjectToolsTable).where(eq(sewingProjectToolsTable.projectId, projectId));
  if (toolIds.length) {
    await db
      .insert(sewingProjectToolsTable)
      .values(toolIds.map((sewingToolId, position) => ({ projectId, sewingToolId, position })));
  }
}

type MachineSettings = MachineSetting<
  (typeof sewingStitchEnum.enumValues)[number],
  (typeof sewingPresserFootEnum.enumValues)[number]
>[];

async function saveMachineSettings(projectId: string, sets: MachineSettings) {
  await db.delete(sewingProjectMachineSettingsTable).where(eq(sewingProjectMachineSettingsTable.projectId, projectId));
  if (sets.length) {
    await db
      .insert(sewingProjectMachineSettingsTable)
      .values(sets.map((set, position) => ({ ...set, projectId, position })));
  }
}

async function saveLinks(projectId: string, links: { stashFabricId: string; amountUsed: number | null }[]) {
  await db.delete(sewingProjectFabricsTable).where(eq(sewingProjectFabricsTable.projectId, projectId));
  if (links.length) {
    await db
      .insert(sewingProjectFabricsTable)
      .values(links.map((link, position) => ({ ...link, projectId, position })));
  }
}

async function findOwn(ownerId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(sewingProjectsTable)
    .where(and(eq(sewingProjectsTable.id, projectId), eq(sewingProjectsTable.ownerId, ownerId)));
  return project;
}

router.get("/sewing-projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetSewingProjectsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sewing project filters." });
    return;
  }

  const filters = [eq(sewingProjectsTable.ownerId, getOwnerId(res))];
  const search = parsed.data.search?.trim();
  if (search) {
    filters.push(or(
      ilike(sewingProjectsTable.title, `%${search}%`),
      ilike(sewingProjectsTable.patternName, `%${search}%`),
      ilike(sewingProjectsTable.patternDesigner, `%${search}%`),
      ilike(sewingProjectsTable.sizeMade, `%${search}%`),
    )!);
  }
  if (parsed.data.status) filters.push(eq(sewingProjectsTable.status, parsed.data.status));

  const projects = await db
    .select()
    .from(sewingProjectsTable)
    .where(and(...filters))
    .orderBy(desc(sewingProjectsTable.updatedAt));
  res.json(await withFabrics(projects));
});

router.post("/sewing-projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateSewingProjectBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.title.trim()) {
    res.status(400).json({ error: "Check the project details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const links = await checkLinks(ownerId, parsed.data.fabrics ?? []);
  if (!links.ok) {
    res.status(400).json({ error: links.error });
    return;
  }
  const tools = await checkTools(ownerId, parsed.data.toolIds ?? []);
  if (!tools.ok) {
    res.status(400).json({ error: tools.error });
    return;
  }
  const settings = checkMachineSettings(parsed.data.machineSettings ?? []);
  if (!settings.ok) {
    res.status(400).json({ error: settings.error });
    return;
  }

  const status = parsed.data.status ?? "planning";
  const [created] = await db
    .insert(sewingProjectsTable)
    .values({
      ownerId,
      title: parsed.data.title.trim(),
      status,
      stage: parsed.data.stage ?? "prep",
      patternName: tidyText(parsed.data.patternName),
      patternDesigner: tidyText(parsed.data.patternDesigner),
      sizeMade: tidyText(parsed.data.sizeMade),
      fitChanges: tidyText(parsed.data.fitChanges),
      needleType: parsed.data.needleType ?? null,
      needleSize: parsed.data.needleSize ?? null,
      threadColor: parsed.data.threadColor ?? null,
      notes: tidyText(parsed.data.notes),
      ...statusChanges({ status: "planning", completedAt: null }, status),
    })
    .returning();
  await saveLinks(created!.id, links.links);
  await saveTools(created!.id, tools.ids);
  await saveMachineSettings(created!.id, settings.sets);
  res.status(201).json((await withFabrics([created!]))[0]);
});

router.get("/sewing-projects/:sewingProjectId", requireAuth, async (req, res): Promise<void> => {
  const params = GetSewingProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }
  const project = await findOwn(getOwnerId(res), params.data.sewingProjectId);
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.json((await withFabrics([project]))[0]);
});

router.patch("/sewing-projects/:sewingProjectId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSewingProjectParams.safeParse(req.params);
  const parsed = UpdateSewingProjectBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0 || parsed.data.title?.trim() === "") {
    res.status(400).json({ error: "Check the project details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const current = await findOwn(ownerId, params.data.sewingProjectId);
  if (!current) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const changes = parsed.data;
  const links = changes.fabrics ? await checkLinks(ownerId, changes.fabrics) : undefined;
  if (links && !links.ok) {
    res.status(400).json({ error: links.error });
    return;
  }
  const tools = changes.toolIds ? await checkTools(ownerId, changes.toolIds) : undefined;
  if (tools && !tools.ok) {
    res.status(400).json({ error: tools.error });
    return;
  }
  const settings = changes.machineSettings ? checkMachineSettings(changes.machineSettings) : undefined;
  if (settings && !settings.ok) {
    res.status(400).json({ error: settings.error });
    return;
  }

  const text = (value: string | null | undefined, existing: string | null) =>
    value !== undefined ? tidyText(value) : existing;
  const [updated] = await db
    .update(sewingProjectsTable)
    .set({
      title: changes.title?.trim() ?? current.title,
      status: changes.status ?? current.status,
      stage: changes.stage ?? current.stage,
      patternName: text(changes.patternName, current.patternName),
      patternDesigner: text(changes.patternDesigner, current.patternDesigner),
      sizeMade: text(changes.sizeMade, current.sizeMade),
      fitChanges: text(changes.fitChanges, current.fitChanges),
      needleType: changes.needleType !== undefined ? changes.needleType : current.needleType,
      needleSize: changes.needleSize !== undefined ? changes.needleSize : current.needleSize,
      threadColor: changes.threadColor !== undefined ? changes.threadColor : current.threadColor,
      notes: text(changes.notes, current.notes),
      ...statusChanges(current, changes.status),
    })
    .where(and(eq(sewingProjectsTable.id, current.id), eq(sewingProjectsTable.ownerId, ownerId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  if (links?.ok) await saveLinks(updated.id, links.links);
  if (tools?.ok) await saveTools(updated.id, tools.ids);
  if (settings?.ok) await saveMachineSettings(updated.id, settings.sets);
  res.json((await withFabrics([updated]))[0]);
});

router.delete("/sewing-projects/:sewingProjectId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteSewingProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }
  const [deleted] = await db
    .delete(sewingProjectsTable)
    .where(and(eq(sewingProjectsTable.id, params.data.sewingProjectId), eq(sewingProjectsTable.ownerId, getOwnerId(res))))
    .returning({ id: sewingProjectsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.sendStatus(204);
});

router.post("/sewing-projects/:sewingProjectId/entries", requireAuth, async (req, res): Promise<void> => {
  const params = AddSewingProjectEntryParams.safeParse(req.params);
  const parsed = AddSewingProjectEntryBody.safeParse(req.body);
  const notes = parsed.success ? parsed.data.notes.trim() : "";
  if (!params.success || !parsed.success || !notes) {
    res.status(400).json({ error: "Write a note first." });
    return;
  }
  if (inFuture(parsed.data.createdAt)) {
    res.status(400).json({ error: "The date can't be in the future." });
    return;
  }
  const project = await findOwn(getOwnerId(res), params.data.sewingProjectId);
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const [entry] = await db
    .insert(sewingProjectEntriesTable)
    .values({ projectId: project.id, notes, ...(parsed.data.createdAt ? { createdAt: parsed.data.createdAt } : {}) })
    .returning();
  res.status(201).json(serializeEntry(entry));
});

async function findOwnEntry(ownerId: string, projectId: string, entryId: string) {
  const project = await findOwn(ownerId, projectId);
  if (!project) return undefined;
  const [entry] = await db
    .select()
    .from(sewingProjectEntriesTable)
    .where(and(eq(sewingProjectEntriesTable.id, entryId), eq(sewingProjectEntriesTable.projectId, project.id)));
  return entry;
}

router.patch("/sewing-projects/:sewingProjectId/entries/:entryId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSewingProjectEntryParams.safeParse(req.params);
  const parsed = UpdateSewingProjectEntryBody.safeParse(req.body);
  const notes = parsed.success ? parsed.data.notes.trim() : "";
  if (!params.success || !parsed.success || !notes) {
    res.status(400).json({ error: "Write a note first." });
    return;
  }
  if (inFuture(parsed.data.createdAt)) {
    res.status(400).json({ error: "The date can't be in the future." });
    return;
  }
  const entry = await findOwnEntry(getOwnerId(res), params.data.sewingProjectId, params.data.entryId);
  if (!entry) {
    res.status(404).json({ error: "Note not found." });
    return;
  }
  const [updated] = await db
    .update(sewingProjectEntriesTable)
    .set({ notes, ...(parsed.data.createdAt ? { createdAt: parsed.data.createdAt } : {}) })
    .where(eq(sewingProjectEntriesTable.id, entry.id))
    .returning();
  res.json(serializeEntry(updated));
});

router.delete("/sewing-projects/:sewingProjectId/entries/:entryId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteSewingProjectEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid note ID." });
    return;
  }
  const entry = await findOwnEntry(getOwnerId(res), params.data.sewingProjectId, params.data.entryId);
  if (!entry) {
    res.status(404).json({ error: "Note not found." });
    return;
  }
  await db.delete(sewingProjectEntriesTable).where(eq(sewingProjectEntriesTable.id, entry.id));
  res.sendStatus(204);
});

router.get("/sewing-overview", requireAuth, async (_req, res): Promise<void> => {
  const ownerId = getOwnerId(res);
  const [projects, pieces] = await Promise.all([
    db
      .select()
      .from(sewingProjectsTable)
      .where(eq(sewingProjectsTable.ownerId, ownerId))
      .orderBy(desc(sewingProjectsTable.updatedAt)),
    db
      .select({ unit: stashFabricsTable.unit, amount: stashFabricsTable.amount, amountLeft: stashFabricsTable.amountLeft, fabricType: stashFabricsTable.fabricType })
      .from(stashFabricsTable)
      // Fabric in the Archive is used up, so it's left out of the stash counts.
      .where(and(eq(stashFabricsTable.ownerId, ownerId), isNull(stashFabricsTable.archivedAt))),
  ]);
  const inProgress = projects.filter((project) => project.status === "in_progress");
  // The stash length is what's still there.
  const { length, unit } = stashLength(pieces.map((piece) => ({ ...piece, amount: piece.amountLeft ?? piece.amount })));
  res.json(GetSewingOverviewResponse.parse({
    inProgress: inProgress.length,
    finished: projects.filter((project) => project.status === "completed").length,
    fabricPieces: pieces.length,
    fabricLength: length,
    fabricUnit: unit,
    stages: sewingStages.map((stage) => ({
      stage,
      count: inProgress.filter((project) => project.stage === stage).length,
    })),
    fabricTypes: fabricTypeCounts(pieces),
    recentProjects: await withFabrics(projects.slice(0, 4)),
  }));
});

export default router;
