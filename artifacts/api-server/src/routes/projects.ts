import { and, desc, eq, gte, ilike, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import {
  AddProgressBody,
  AddProgressParams,
  AddProgressResponse,
  CreateProjectBody,
  CreateProjectResponse,
  DeleteProjectParams,
  StarProjectParams,
  UnstarProjectParams,
  DeleteProgressPhotoParams,
  GetDashboardResponse,
  GetProjectParams,
  GetProjectResponse,
  GetProjectsQueryParams,
  GetProjectsResponse,
  GetProjectsResponseItem,
  GetProgressPhotoParams,
  RequestProgressPhotoUploadBody,
  RequestProgressPhotoUploadParams,
  RequestProgressPhotoUploadResponse,
  PreviewDesignerWebsiteTitleBody,
  PreviewDesignerWebsiteTitleResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
} from "@workspace/api-zod";
import {
  db,
  progressEntriesTable,
  projectsTable,
  starsTable,
  type Project,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { buildDashboardCharts, progressChartStart } from "../lib/dashboardCharts";
import {
  normalizeDesignerPageTitle,
  previewWebsitePageTitle,
  WebsiteTitlePreviewError,
} from "../lib/websiteTitlePreview";

const router: IRouter = Router();
router.use(requireAuth);
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoSize = 10 * 1024 * 1024;

function storageLocation(relativePath: string) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured.");
  const normalizedDir = privateDir.startsWith("/") ? privateDir : `/${privateDir}`;
  const fullPath = `${normalizedDir.replace(/\/+$/, "")}/${relativePath}`;
  const [, bucketName, ...objectParts] = fullPath.split("/");
  if (!bucketName || objectParts.length === 0) {
    throw new Error("PRIVATE_OBJECT_DIR is invalid.");
  }
  return { bucketName, objectName: objectParts.join("/") };
}

async function signedObjectUrl(
  bucketName: string,
  objectName: string,
  method: "DELETE" | "GET" | "PUT",
): Promise<string> {
  const response = await fetch("http://127.0.0.1:1106/object-storage/signed-object-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + (method === "PUT" ? 900 : 300) * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Storage URL signing failed (${response.status}).`);
  const result = (await response.json()) as { signed_url?: string };
  if (!result.signed_url) throw new Error("Storage returned no signed URL.");
  return result.signed_url;
}

async function deleteStoredObject(relativePath: string): Promise<void> {
  const { bucketName, objectName } = storageLocation(relativePath);
  const url = await signedObjectUrl(bucketName, objectName, "DELETE");
  const response = await fetch(url, {
    method: "DELETE",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Storage object deletion failed (${response.status}).`);
}

function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type ProjectStatus = Project["status"];

// Keeps the completed date in step with the status: finishing a project
// fills in today's date unless one is already set, and reopening a
// finished project clears it.
function completedDateChanges(
  current: { status: ProjectStatus; completedAt: string | null },
  nextStatus: ProjectStatus,
): { completedAt?: string | null; completedAtPrecision?: "day" } {
  if (nextStatus === "completed" && !current.completedAt) {
    return { completedAt: today(), completedAtPrecision: "day" };
  }
  if (nextStatus !== "completed" && current.status === "completed") {
    return { completedAt: null };
  }
  return {};
}

function serializeProject(project: Project, starred: boolean) {
  const validated = GetProjectsResponseItem.parse({ ...project, starred });
  return {
    ...validated,
    designerPageTitle: project.designerPageTitle
      ? normalizeDesignerPageTitle(project.designerPageTitle)
      : null,
    startedAt: project.startedAt,
    targetDate: project.targetDate,
    completedAt: project.completedAt,
  };
}

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

async function starredProjectIds(ownerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ projectId: starsTable.projectId })
    .from(starsTable)
    .where(eq(starsTable.userId, ownerId));
  return new Set(rows.map((row) => row.projectId));
}

async function isStarred(ownerId: string, projectId: string): Promise<boolean> {
  const [star] = await db
    .select({ projectId: starsTable.projectId })
    .from(starsTable)
    .where(and(eq(starsTable.userId, ownerId), eq(starsTable.projectId, projectId)));
  return Boolean(star);
}

async function findOwnedProjectId(ownerId: string, projectId: string): Promise<string | null> {
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.ownerId, ownerId)));
  return project?.id ?? null;
}

router.post("/projects/designer-website-title-preview", async (req, res): Promise<void> => {
  const parsed = PreviewDesignerWebsiteTitleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid designer website link." });
    return;
  }

  try {
    const preview = await previewWebsitePageTitle(parsed.data.websiteUrl);
    res.json(PreviewDesignerWebsiteTitleResponse.parse(preview));
  } catch (error) {
    if (error instanceof WebsiteTitlePreviewError && error.statusCode === 400) {
      res.status(400).json({ error: error.message });
      return;
    }
    req.log.warn({ err: error }, "Could not preview a designer website title");
    res.status(502).json({ error: "Could not load that page title. Check the link and try again." });
  }
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const ownerId = getOwnerId(res);
  const now = new Date();
  const [allProjects, recentProjects, recentProgress, chartProgress] = await Promise.all([
    db
      .select({
        status: projectsTable.status,
        completedAt: projectsTable.completedAt,
      })
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
    db
      .select({ createdAt: progressEntriesTable.createdAt })
      .from(progressEntriesTable)
      .innerJoin(
        projectsTable,
        eq(progressEntriesTable.projectId, projectsTable.id),
      )
      .where(
        and(
          eq(projectsTable.ownerId, ownerId),
          gte(progressEntriesTable.createdAt, progressChartStart(now)),
        ),
      ),
  ]);
  const starredIds = await starredProjectIds(ownerId);
  const serializedRecent = recentProjects.map((project) =>
    serializeProject(project, starredIds.has(project.id)),
  );

  const dashboard = GetDashboardResponse.parse({
    totalProjects: allProjects.length,
    activeProjects: allProjects.filter(
      (project) => project.status === "in_progress",
    ).length,
    completedProjects: allProjects.filter(
      (project) => project.status === "completed",
    ).length,
    recentProjects: serializedRecent,
    recentProgress,
    charts: buildDashboardCharts(
      allProjects,
      chartProgress.map((entry) => entry.createdAt),
      now,
    ),
  });
  res.json({ ...dashboard, recentProjects: serializedRecent });
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

  const [rows, starredIds] = await Promise.all([
    db
      .select()
      .from(projectsTable)
      .where(and(...filters))
      .orderBy(desc(projectsTable.updatedAt)),
    starredProjectIds(ownerId),
  ]);
  // The generated query schema turns any value into true, so only the exact
  // text "true" turns the Starred filter on.
  const onlyStarred = req.query.starred === "true";
  res.json(
    rows
      .filter((project) => !onlyStarred || starredIds.has(project.id))
      .map((project) => serializeProject(project, starredIds.has(project.id))),
  );
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the project details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const { startedAt, targetDate, ...fields } = parsed.data;
  const [created] = await db
    .insert(projectsTable)
    .values({
      description: null,
      patternName: null,
      patternDesigner: null,
      designerWebsite: null,
      designerPageTitle: null,
      yarn: null,
      yarnBrand: null,
      yarnType: null,
      yarnColor: null,
      tools: null,
      hookSize: null,
      status: "planning",
      startedAtPrecision: "day",
      targetDatePrecision: "day",
      completedAt: null,
      completedAtPrecision: "day",
      ...fields,
      title: fields.title.trim(),
      ownerId,
      startedAt: dateOnly(startedAt),
      targetDate: dateOnly(targetDate),
      ...completedDateChanges(
        { status: "planning", completedAt: null },
        fields.status ?? "planning",
      ),
    })
    .returning();
  res.status(201).json(serializeProject(created, false));
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
  res.json({
    ...serializeProject(project, await isStarred(ownerId, project.id)),
    progress,
  });
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Check the project details and try again." });
    return;
  }

  const ownerId = getOwnerId(res);
  const { startedAt, targetDate, completedAt, title, ...otherChanges } = parsed.data;
  const changes = {
    ...otherChanges,
    ...(title !== undefined ? { title: title.trim() } : {}),
    ...(startedAt !== undefined ? { startedAt: dateOnly(startedAt) } : {}),
    ...(targetDate !== undefined ? { targetDate: dateOnly(targetDate) } : {}),
    ...(completedAt !== undefined ? { completedAt: dateOnly(completedAt) } : {}),
  };
  if (Object.keys(changes).length === 0) {
    res.status(400).json({ error: "Check the project details and try again." });
    return;
  }

  // A completed date sent with the change wins over the automatic one.
  if (changes.status !== undefined && completedAt === undefined) {
    const [current] = await db
      .select({ status: projectsTable.status, completedAt: projectsTable.completedAt })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, params.data.projectId),
          eq(projectsTable.ownerId, ownerId),
        ),
      );
    if (!current) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    Object.assign(changes, completedDateChanges(current, changes.status));
  }

  const [updated] = await db
    .update(projectsTable)
    .set(changes)
    .where(
      and(
        eq(projectsTable.id, params.data.projectId),
        eq(projectsTable.ownerId, ownerId),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.json(serializeProject(updated, await isStarred(ownerId, updated.id)));
});

router.delete("/projects/:projectId", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }

  const ownerId = getOwnerId(res);
  const photos = await db
    .select({ photoPath: progressEntriesTable.photoPath })
    .from(progressEntriesTable)
    .innerJoin(projectsTable, eq(progressEntriesTable.projectId, projectsTable.id))
    .where(
      and(
        eq(progressEntriesTable.projectId, params.data.projectId),
        eq(projectsTable.ownerId, ownerId),
      ),
    );
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

  // The database rows are gone, so the photos can no longer be reached
  // through the app. Removing the stored files is cleanup: a failure is
  // logged and the delete still succeeds.
  const expectedPrefix = `/objects/progress/${project.id}/`;
  for (const photoPath of new Set(
    photos.flatMap(({ photoPath }) => photoPath ? [photoPath] : []),
  )) {
    const objectName = photoPath.slice(expectedPrefix.length);
    if (
      !photoPath.startsWith(expectedPrefix) ||
      !objectName ||
      objectName.includes("/") ||
      objectName.includes("\\")
    ) {
      req.log.error(
        { projectId: project.id, photoPath },
        "Could not delete progress photo because its stored path is invalid",
      );
      continue;
    }

    try {
      await deleteStoredObject(`progress/${project.id}/${objectName}`);
    } catch (error) {
      req.log.error(
        { err: error, projectId: project.id, photoPath },
        "Could not delete stored progress photo",
      );
    }
  }
  res.sendStatus(204);
});

router.put("/projects/:projectId/star", async (req, res): Promise<void> => {
  const params = StarProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }

  const ownerId = getOwnerId(res);
  const projectId = await findOwnedProjectId(ownerId, params.data.projectId);
  if (!projectId) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  await db
    .insert(starsTable)
    .values({ userId: ownerId, projectId })
    .onConflictDoNothing();
  res.sendStatus(204);
});

router.delete("/projects/:projectId/star", async (req, res): Promise<void> => {
  const params = UnstarProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID." });
    return;
  }

  const ownerId = getOwnerId(res);
  const projectId = await findOwnedProjectId(ownerId, params.data.projectId);
  if (!projectId) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  await db
    .delete(starsTable)
    .where(and(eq(starsTable.userId, ownerId), eq(starsTable.projectId, projectId)));
  res.sendStatus(204);
});

router.post(
  "/projects/:projectId/progress-photo-upload",
  async (req, res): Promise<void> => {
    const params = RequestProgressPhotoUploadParams.safeParse(req.params);
    const parsed = RequestProgressPhotoUploadBody.safeParse(req.body);
    if (
      !params.success ||
      !parsed.success ||
      !allowedPhotoTypes.has(parsed.data.contentType) ||
      parsed.data.size > maxPhotoSize
    ) {
      res.status(400).json({ error: "Choose a JPEG, PNG, or WebP photo up to 10 MB." });
      return;
    }

    const ownerId = getOwnerId(res);
    const [project] = await db
      .select({ id: projectsTable.id })
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

    try {
      const relativePath = `progress/${project.id}/${randomUUID()}`;
      const { bucketName, objectName } = storageLocation(relativePath);
      const uploadURL = await signedObjectUrl(bucketName, objectName, "PUT");
      res.json(
        RequestProgressPhotoUploadResponse.parse({
          uploadURL,
          photoPath: `/objects/${relativePath}`,
        }),
      );
    } catch (error) {
      req.log.error({ err: error, projectId: project.id }, "Could not create progress photo upload URL");
      res.status(500).json({ error: "Could not prepare the photo upload." });
    }
  },
);

router.get(
  "/projects/:projectId/progress/:entryId/photo",
  async (req, res): Promise<void> => {
    const params = GetProgressPhotoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid progress photo request." });
      return;
    }

    const ownerId = getOwnerId(res);
    const [entry] = await db
      .select({ photoPath: progressEntriesTable.photoPath })
      .from(progressEntriesTable)
      .innerJoin(projectsTable, eq(progressEntriesTable.projectId, projectsTable.id))
      .where(
        and(
          eq(progressEntriesTable.id, params.data.entryId),
          eq(progressEntriesTable.projectId, params.data.projectId),
          eq(projectsTable.ownerId, ownerId),
        ),
      );
    const expectedPrefix = `/objects/progress/${params.data.projectId}/`;
    if (!entry?.photoPath || !entry.photoPath.startsWith(expectedPrefix)) {
      res.status(404).json({ error: "Progress photo not found." });
      return;
    }

    try {
      const { bucketName, objectName } = storageLocation(entry.photoPath.slice("/objects/".length));
      res.redirect(302, await signedObjectUrl(bucketName, objectName, "GET"));
    } catch (error) {
      req.log.error(
        { err: error, projectId: params.data.projectId, entryId: params.data.entryId },
        "Could not serve progress photo",
      );
      res.status(500).json({ error: "Could not load the progress photo." });
    }
  },
);

router.delete(
  "/projects/:projectId/progress/:entryId/photo",
  async (req, res): Promise<void> => {
    const params = DeleteProgressPhotoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid progress photo request." });
      return;
    }

    const ownerId = getOwnerId(res);
    const [entry] = await db
      .select({ id: progressEntriesTable.id, projectId: progressEntriesTable.projectId })
      .from(progressEntriesTable)
      .innerJoin(projectsTable, eq(progressEntriesTable.projectId, projectsTable.id))
      .where(
        and(
          eq(progressEntriesTable.id, params.data.entryId),
          eq(progressEntriesTable.projectId, params.data.projectId),
          eq(projectsTable.ownerId, ownerId),
        ),
      );
    if (!entry) {
      res.status(404).json({ error: "Progress photo not found." });
      return;
    }

    const [updated] = await db
      .update(progressEntriesTable)
      .set({ photoPath: null })
      .where(
        and(
          eq(progressEntriesTable.id, entry.id),
          eq(progressEntriesTable.projectId, entry.projectId),
        ),
      )
      .returning({ id: progressEntriesTable.id });
    if (!updated) {
      res.status(404).json({ error: "Progress photo not found." });
      return;
    }
    res.sendStatus(204);
  },
);

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
      .select({
        id: projectsTable.id,
        status: projectsTable.status,
        completedAt: projectsTable.completedAt,
      })
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
    const photoPath = parsed.data.photoPath;
    if (
      photoPath &&
      !new RegExp(`^/objects/progress/${project.id}/[0-9a-f-]{36}$`, "i").test(photoPath)
    ) {
      res.status(400).json({ error: "The photo must belong to this project." });
      return;
    }

    const nextStatus: ProjectStatus =
      parsed.data.completionPercent === 100
        ? "completed"
        : project.status === "completed"
          ? "in_progress"
          : project.status;
    const [entry] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(progressEntriesTable)
        .values({
          projectId: project.id,
          notes: parsed.data.notes.trim(),
          photoPath: parsed.data.photoPath ?? null,
          completionPercent: parsed.data.completionPercent,
        })
        .returning();
      await tx
        .update(projectsTable)
        .set({
          completionPercent: parsed.data.completionPercent,
          status: nextStatus,
          ...completedDateChanges(project, nextStatus),
        })
        .where(eq(projectsTable.id, project.id));
      return [created];
    });

    const validated = AddProgressResponse.parse(entry);
    res.status(201).json(validated);
  },
);

export default router;
