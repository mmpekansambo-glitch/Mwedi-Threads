import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  CreateSewingProjectBody,
  DeleteSewingProjectParams,
  GetSewingOverviewResponse,
  GetSewingProjectParams,
  GetSewingProjectResponse,
  GetSewingProjectsQueryParams,
  UpdateSewingProjectBody,
  UpdateSewingProjectParams,
} from "@workspace/api-zod";
import {
  db,
  sewingProjectFabricsTable,
  sewingProjectsTable,
  stashFabricsTable,
  type SewingProject,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { checkFabricLinks, sewingStages, stashLength, statusChanges } from "../lib/sewingProjects";
import { serializeFabric } from "./fabricStash";

const router: IRouter = Router();

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

function tidyText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

// Adds each project's stash fabric, in the order the maker listed it.
async function withFabrics(projects: SewingProject[]) {
  const ids = projects.map((project) => project.id);
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
      notes: tidyText(parsed.data.notes),
      ...statusChanges({ status: "planning", completedAt: null }, status),
    })
    .returning();
  await saveLinks(created!.id, links.links);
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

router.get("/sewing-overview", requireAuth, async (_req, res): Promise<void> => {
  const ownerId = getOwnerId(res);
  const [projects, pieces] = await Promise.all([
    db
      .select()
      .from(sewingProjectsTable)
      .where(eq(sewingProjectsTable.ownerId, ownerId))
      .orderBy(desc(sewingProjectsTable.updatedAt)),
    db
      .select({ unit: stashFabricsTable.unit, amount: stashFabricsTable.amount })
      .from(stashFabricsTable)
      .where(eq(stashFabricsTable.ownerId, ownerId)),
  ]);
  const inProgress = projects.filter((project) => project.status === "in_progress");
  const { length, unit } = stashLength(pieces);
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
    recentProjects: await withFabrics(projects.slice(0, 4)),
  }));
});

export default router;
