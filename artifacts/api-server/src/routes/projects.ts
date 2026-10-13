import { and, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  AddProgressBody,
  AddProgressParams,
  AddProgressResponse,
  CreateProjectBody,
  CreateProjectResponse,
  DeleteProjectParams,
  GetDashboardResponse,
  GetProjectParams,
  GetProjectResponse,
  GetProjectsQueryParams,
  GetProjectsResponse,
  GetProjectsResponseItem,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
} from "@workspace/api-zod";
import {
  db,
  progressEntriesTable,
  projectsTable,
  type Project,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function serializeProject(project: Project) {
  const validated = GetProjectsResponseItem.parse(project);
  return {
    ...validated,
    startedAt: project.startedAt,
    targetDate: project.targetDate,
  };
}

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const ownerId = getOwnerId(res);
  const [allProjects, recentProjects, recentProgress] = await Promise.all([
    db
      .select({ status: projectsTable.status })
      .from(projectsTable)
      .where(eq(projectsTable.ownerId, ownerId)),
    db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.ownerId, ownerId))
      .orderBy(desc(projectsTable.updatedAt))
      .limit(5),
    db
      .select({
        projectTitle: projectsTable.title,
        projectId: projectsTable.id,
        notes: progressEntriesTable.notes,
        completionPercent: progressEntriesTable.completionPercent,
        createdAt: progressEntriesTable.createdAt,
      })
      .from(progressEntriesTable)
      .innerJoin(
        projectsTable,
        eq(progressEntriesTable.projectId, projectsTable.id),
      )
      .where(eq(projectsTable.ownerId, ownerId))
      .orderBy(desc(progressEntriesTable.createdAt))
      .limit(6),
  ]);

  const dashboard = {
    totalProjects: allProjects.length,
    activeProjects: allProjects.filter(
      (project) => project.status === "in_progress",
    ).length,
    completedProjects: allProjects.filter(
      (project) => project.status === "completed",
    ).length,
    recentProjects,
    recentProgress,
  };
  const validated = GetDashboardResponse.parse(dashboard);
  res.json({
    ...validated,
    recentProjects: recentProjects.map(serializeProject),
  });
  req.log.debug({ ownerId }, "Loaded Mwedi Threads dashboard");
});

router.get("/projects", async (req, res): Promise<void> => {
  const parsedQuery = GetProjectsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid project filters." });
    return;
  }

  const ownerId = getOwnerId(res);
  const filters = [eq(projectsTable.ownerId, ownerId)];
  const search = parsedQuery.data.search?.trim();
  if (search) {
    filters.push(
      or(
        ilike(projectsTable.title, `%${search}%`),
        ilike(projectsTable.patternName, `%${search}%`),
        ilike(projectsTable.patternDesigner, `%${search}%`),
      )!,
    );
  }
  if (parsedQuery.data.status) {
    filters.push(eq(projectsTable.status, parsedQuery.data.status));
  }
  if (parsedQuery.data.craft) {
    filters.push(eq(projectsTable.craft, parsedQuery.data.craft));
  }

  const rows = await db
    .select()
    .from(projectsTable)
    .where(and(...filters))
    .orderBy(desc(projectsTable.updatedAt));
  const validated = GetProjectsResponse.parse(rows);
  res.json(
    validated.map((project, index) => ({
      ...project,
      startedAt: rows[index]?.startedAt ?? null,
      targetDate: rows[index]?.targetDate ?? null,
    })),
  );
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the project details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const [project] = await db
    .insert(projectsTable)
    .values({
      ...parsed.data,
      ownerId,
      status: parsed.data.status ?? "planning",
      description: parsed.data.description ?? null,
      patternName: parsed.data.patternName ?? null,
      patternDesigner: parsed.data.patternDesigner ?? null,
      yarn: parsed.data.yarn ?? null,
      tools: parsed.data.tools ?? null,
      startedAt: dateOnly(parsed.data.startedAt),
      targetDate: dateOnly(parsed.data.targetDate),
    })
    .returning();

  if (!project) {
    res.status(500).json({ error: "The project could not be saved." });
    return;
  }
  const validated = CreateProjectResponse.parse(project);
  res.status(201).json({
    ...validated,
    startedAt: project.startedAt,
    targetDate: project.targetDate,
  });
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }

  const ownerId = getOwnerId(res);
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.id, params.data.projectId),
        eq(projectsTable.ownerId, ownerId),
      ),
    );
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const progress = await db
    .select()
    .from(progressEntriesTable)
    .where(eq(progressEntriesTable.projectId, project.id))
    .orderBy(desc(progressEntriesTable.createdAt));
  const validated = GetProjectResponse.parse({ ...project, progress });
  res.json({
    ...validated,
    startedAt: project.startedAt,
    targetDate: project.targetDate,
  });
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (
    !params.success ||
    !parsed.success ||
    Object.keys(parsed.data ?? {}).length === 0
  ) {
    res.status(400).json({ error: "Check the project details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const { startedAt, targetDate, ...otherChanges } = parsed.data;
  const changes = {
    ...otherChanges,
    ...(startedAt !== undefined
      ? { startedAt: dateOnly(startedAt) }
      : {}),
    ...(targetDate !== undefined
      ? { targetDate: dateOnly(targetDate) }
      : {}),
  };
  const [project] = await db
    .update(projectsTable)
    .set(changes)
    .where(
      and(
        eq(projectsTable.id, params.data.projectId),
        eq(projectsTable.ownerId, ownerId),
      ),
    )
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const validated = UpdateProjectResponse.parse(project);
  res.json({
    ...validated,
    startedAt: project.startedAt,
    targetDate: project.targetDate,
  });
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }

  const ownerId = getOwnerId(res);
  const [project] = await db
    .delete(projectsTable)
    .where(
      and(
        eq(projectsTable.id, params.data.projectId),
        eq(projectsTable.ownerId, ownerId),
      ),
    )
    .returning({ id: projectsTable.id });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.sendStatus(204);
});

router.post(
  "/projects/:projectId/progress",
  async (req, res): Promise<void> => {
    const params = AddProgressParams.safeParse(req.params);
    const parsed = AddProgressBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Check the progress update and try again." });
      return;
    }

    const ownerId = getOwnerId(res);
    const [project] = await db
      .select({ id: projectsTable.id, status: projectsTable.status })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, params.data.projectId),
          eq(projectsTable.ownerId, ownerId),
        ),
      );
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const [entry] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(progressEntriesTable)
        .values({
          projectId: project.id,
          notes: parsed.data.notes.trim(),
          completionPercent: parsed.data.completionPercent,
        })
        .returning();
      await tx
        .update(projectsTable)
        .set({
          completionPercent: parsed.data.completionPercent,
          status:
            parsed.data.completionPercent === 100
              ? "completed"
              : project.status === "completed"
                ? "in_progress"
                : project.status,
        })
        .where(eq(projectsTable.id, project.id));
      return [created];
    });

    const validated = AddProgressResponse.parse(entry);
    res.status(201).json(validated);
  },
);

export default router;
