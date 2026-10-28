import { eq, sql } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import { GetMyCraftsResponse, UpdateMyCraftsBody } from "@workspace/api-zod";
import { db, projectsTable, sewingProjectsTable, sewingToolsTable, stashFabricsTable, stashYarnsTable, usersTable, yarnToolsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

// A maker who hasn't picked their crafts and has nothing saved yet is new, so
// the app asks "What do you make?". Anyone with projects or stash already
// keeps yarn on without being asked.
async function loadCrafts(ownerId: string) {
  const [row] = await db
    .select({ yarn: usersTable.yarnEnabled, sewing: usersTable.sewingEnabled, chosenAt: usersTable.craftsChosenAt })
    .from(usersTable)
    .where(eq(usersTable.id, ownerId));
  const hasSomething = row?.chosenAt
    ? true
    : (await Promise.all(
        [projectsTable, stashYarnsTable, stashFabricsTable, sewingProjectsTable, sewingToolsTable, yarnToolsTable].map((table) =>
          db.select({ one: sql`1` }).from(table).where(eq(table.ownerId, ownerId)).limit(1),
        ),
      )).some((rows) => rows.length > 0);
  return GetMyCraftsResponse.parse({
    yarn: row?.yarn ?? true,
    sewing: row?.sewing ?? false,
    needsChoice: !hasSomething,
  });
}

router.get("/me/crafts", requireAuth, async (_req, res): Promise<void> => {
  res.json(await loadCrafts(getOwnerId(res)));
});

router.put("/me/crafts", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMyCraftsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose which crafts to turn on." });
    return;
  }
  if (!parsed.data.yarn && !parsed.data.sewing) {
    res.status(400).json({ error: "Keep at least one craft on." });
    return;
  }

  const ownerId = getOwnerId(res);
  await db
    .update(usersTable)
    .set({ yarnEnabled: parsed.data.yarn, sewingEnabled: parsed.data.sewing, craftsChosenAt: new Date() })
    .where(eq(usersTable.id, ownerId));
  res.json(await loadCrafts(ownerId));
});

export default router;
