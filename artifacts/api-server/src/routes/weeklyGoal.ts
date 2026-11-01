import { eq, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { SetWeeklyGoalBody } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { recordCraftActivity } from "../lib/craftActivity";
import { LOOKBACK_WEEKS, addDays, isPlainDate, mondayOf, safeTimeZone, summariseWeek, type Studio } from "../lib/weeklyGoal";

const router: IRouter = Router();

function getOwnerId(res: Response): string {
  return res.locals.userId as string;
}

type WeekQuery = { studio: Studio; today: string; timeZone: string };

function readQuery(req: Request): WeekQuery | null {
  const { studio, today, timeZone } = req.query;
  if ((studio !== "yarn" && studio !== "sewing") || !isPlainDate(today)) return null;
  return { studio, today, timeZone: safeTimeZone(timeZone) };
}

// Every day on the maker's calendar with crafting in this studio, from the
// activity log and from the notes still in that studio's journals.
async function craftingDays(ownerId: string, { studio, today, timeZone }: WeekQuery): Promise<Set<string>> {
  const from = addDays(mondayOf(today), -7 * LOOKBACK_WEEKS - 1);
  const notes = studio === "yarn"
    ? sql`select e.created_at as at from project_progress_entries e join projects p on p.id = e.project_id where p.owner_id = ${ownerId}`
    : sql`select e.created_at as at from sewing_project_entries e join sewing_projects p on p.id = e.project_id where p.owner_id = ${ownerId}`;
  const result = await db.execute<{ day: string }>(sql`
    select distinct to_char((at at time zone ${timeZone})::date, 'YYYY-MM-DD') as day
    from (
      select hour as at from craft_activity where user_id = ${ownerId} and studio = ${studio}
      union all
      ${notes}
    ) activity
    where at >= ${from}::date - interval '1 day'
  `);
  const days = new Set<string>();
  for (const row of result.rows) if (row.day >= from && row.day <= today) days.add(row.day);
  return days;
}

async function loadGoal(ownerId: string, studio: Studio): Promise<number | null> {
  const [row] = await db
    .select({ yarn: usersTable.yarnWeeklyGoal, sewing: usersTable.sewingWeeklyGoal })
    .from(usersTable)
    .where(eq(usersTable.id, ownerId));
  return (studio === "yarn" ? row?.yarn : row?.sewing) ?? null;
}

async function weekFor(ownerId: string, query: WeekQuery) {
  const [goal, days] = await Promise.all([loadGoal(ownerId, query.studio), craftingDays(ownerId, query)]);
  return summariseWeek(days, query.today, goal);
}

const badQuery = "Send the studio and today's date.";

router.get("/weekly-goal", requireAuth, async (req, res): Promise<void> => {
  const query = readQuery(req);
  if (!query) {
    res.status(400).json({ error: badQuery });
    return;
  }
  res.json(await weekFor(getOwnerId(res), query));
});

router.put("/weekly-goal", requireAuth, async (req, res): Promise<void> => {
  const query = readQuery(req);
  const body = SetWeeklyGoalBody.safeParse(req.body);
  if (!query || !body.success) {
    res.status(400).json({ error: query ? "Pick from 1 to 7 days, or turn the goal off." : badQuery });
    return;
  }
  const ownerId = getOwnerId(res);
  await db
    .update(usersTable)
    .set(query.studio === "yarn" ? { yarnWeeklyGoal: body.data.goal } : { sewingWeeklyGoal: body.data.goal })
    .where(eq(usersTable.id, ownerId));
  res.json(await weekFor(ownerId, query));
});

// "I crafted today" / "I sewed today".
router.post("/weekly-goal/check-in", requireAuth, async (req, res): Promise<void> => {
  const query = readQuery(req);
  if (!query) {
    res.status(400).json({ error: badQuery });
    return;
  }
  const ownerId = getOwnerId(res);
  await recordCraftActivity(ownerId, query.studio);
  res.json(await weekFor(ownerId, query));
});

export default router;
