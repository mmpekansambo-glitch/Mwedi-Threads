import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  projectYarnsTable,
  projectsTable,
  skeinSuggestionsTable,
  stashYarnsTable,
  type StashYarn,
} from "@workspace/db";
import { matchKey, tidyName } from "./yarnCatalog";
import { addToCatalog, type Transaction } from "./yarnCatalogStore";

export const maxProjectYarns = 12;

export type ProjectYarnInput = {
  stashYarnId?: string | null;
  brand?: string | null;
  subBrand?: string | null;
  color?: string | null;
  heldTogether?: boolean;
  skeinsUsed?: number | null;
};

export type CheckedProjectYarn = {
  stashYarnId: string | null;
  brand: string | null;
  subBrand: string | null;
  color: string | null;
  heldTogether: boolean;
  skeinsUsed: number | null;
};

type YarnsCheck =
  | { ok: true; yarns: CheckedProjectYarn[] }
  | { ok: false; error: string };

function cleanName(value: string | null | undefined): string | null {
  return value && matchKey(value) ? tidyName(value) : null;
}

// Drops empty rows, tidies the names and checks skeins. The first yarn
// can't be held together with a yarn above it.
export function checkProjectYarns(inputs: ProjectYarnInput[]): YarnsCheck {
  const yarns = inputs
    .map((input) => ({
      stashYarnId: input.stashYarnId ?? null,
      brand: cleanName(input.brand),
      subBrand: cleanName(input.subBrand),
      color: cleanName(input.color),
      heldTogether: Boolean(input.heldTogether),
      skeinsUsed: input.skeinsUsed ?? null,
    }))
    .filter((yarn) => yarn.stashYarnId || yarn.brand || yarn.subBrand || yarn.color);
  if (yarns.length > maxProjectYarns) {
    return { ok: false, error: `A project can list up to ${maxProjectYarns} yarns.` };
  }
  if (yarns.some((yarn) => yarn.skeinsUsed !== null && (yarn.skeinsUsed < 0 || yarn.skeinsUsed > 999 || !Number.isInteger(yarn.skeinsUsed * 2)))) {
    return { ok: false, error: "Enter skeins used in whole or half skeins." };
  }
  if (yarns[0]) yarns[0].heldTogether = false;
  return { ok: true, yarns };
}

export class StashYarnNotFound extends Error {}

// Finds the maker's stash yarn with the same catalog brand, sub brand and
// color, or adds one without a photo, so every new project yarn ends up in
// the stash.
async function stashYarnFor(tx: Transaction, ownerId: string, yarn: CheckedProjectYarn & { brand: string }) {
  const catalog = await addToCatalog(tx, {
    brand: yarn.brand,
    subBrand: yarn.subBrand,
    color: yarn.color,
    generalColor: null,
    blend: [],
    brandLink: null,
  });
  const sameLine = catalog.lineId ? eq(stashYarnsTable.lineId, catalog.lineId) : isNull(stashYarnsTable.lineId);
  const sameColor = catalog.colorId
    ? eq(stashYarnsTable.colorId, catalog.colorId)
    : catalog.color
      ? sql`lower(${stashYarnsTable.color}) = lower(${catalog.color})`
      : isNull(stashYarnsTable.color);
  const [existing] = await tx
    .select()
    .from(stashYarnsTable)
    .where(and(eq(stashYarnsTable.ownerId, ownerId), eq(stashYarnsTable.brandId, catalog.brandId), sameLine, sameColor))
    .limit(1);
  if (existing) return existing;
  const [created] = await tx
    .insert(stashYarnsTable)
    .values({ ...catalog, ownerId, photoPath: null })
    .returning();
  return created;
}

// Replaces the project's yarn list. Yarn picked from the stash copies the
// stash yarn's names; yarn typed in with a brand is matched to the stash or
// added to it.
export async function saveProjectYarns(
  tx: Transaction,
  ownerId: string,
  projectId: string,
  yarns: CheckedProjectYarn[],
): Promise<void> {
  const rows = [];
  for (const [position, yarn] of yarns.entries()) {
    let stash: StashYarn | undefined;
    if (yarn.stashYarnId) {
      [stash] = await tx
        .select()
        .from(stashYarnsTable)
        .where(and(eq(stashYarnsTable.id, yarn.stashYarnId), eq(stashYarnsTable.ownerId, ownerId)));
      if (!stash) throw new StashYarnNotFound();
    } else if (yarn.brand) {
      stash = await stashYarnFor(tx, ownerId, { ...yarn, brand: yarn.brand });
    }
    rows.push({
      projectId,
      position,
      stashYarnId: stash?.id ?? null,
      brand: stash ? stash.brand : yarn.brand,
      subBrand: stash ? stash.subBrand : yarn.subBrand,
      color: stash ? stash.color : yarn.color,
      heldTogether: yarn.heldTogether,
      skeinsUsed: yarn.skeinsUsed,
    });
  }
  await tx.delete(projectYarnsTable).where(eq(projectYarnsTable.projectId, projectId));
  if (rows.length) await tx.insert(projectYarnsTable).values(rows);
}

export type ProjectYarnView = {
  id: string;
  stashYarnId: string | null;
  brand: string | null;
  subBrand: string | null;
  color: string | null;
  generalColor: StashYarn["generalColor"];
  heldTogether: boolean;
  skeinsUsed: number | null;
};

export async function projectYarnsFor(projectIds: string[]): Promise<Map<string, ProjectYarnView[]>> {
  const byProject = new Map<string, ProjectYarnView[]>(projectIds.map((id) => [id, []]));
  if (projectIds.length === 0) return byProject;
  const rows = await db
    .select({
      projectId: projectYarnsTable.projectId,
      id: projectYarnsTable.id,
      stashYarnId: projectYarnsTable.stashYarnId,
      brand: projectYarnsTable.brand,
      subBrand: projectYarnsTable.subBrand,
      color: projectYarnsTable.color,
      generalColor: stashYarnsTable.generalColor,
      heldTogether: projectYarnsTable.heldTogether,
      skeinsUsed: projectYarnsTable.skeinsUsed,
    })
    .from(projectYarnsTable)
    .leftJoin(stashYarnsTable, eq(projectYarnsTable.stashYarnId, stashYarnsTable.id))
    .where(inArray(projectYarnsTable.projectId, projectIds))
    .orderBy(asc(projectYarnsTable.position));
  for (const { projectId, ...yarn } of rows) {
    byProject.get(projectId)?.push({ ...yarn, generalColor: yarn.generalColor ?? null });
  }
  return byProject;
}

const cleanOwners = new Set<string>();

// Projects made before a project could list several yarns kept one brand,
// type and color on the project itself. The first time a maker's projects
// are loaded, that yarn becomes the first entry in each project's list.
export async function moveOldProjectYarns(ownerId: string): Promise<void> {
  if (cleanOwners.has(ownerId)) return;
  const hasOldYarn = sql`(nullif(trim(${projectsTable.yarnBrand}), '') is not null or nullif(trim(${projectsTable.yarnType}), '') is not null or nullif(trim(${projectsTable.yarnColor}), '') is not null)`;
  const [waiting] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.ownerId, ownerId), hasOldYarn))
    .limit(1);
  if (waiting) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`project-yarns:${ownerId}`}))`);
      await tx.execute(sql`
        insert into ${projectYarnsTable} (project_id, position, brand, sub_brand, color)
        select p.id, 0, nullif(trim(p.yarn_brand), ''), nullif(trim(p.yarn_type), ''), nullif(trim(p.yarn_color), '')
        from ${projectsTable} p
        where p.owner_id = ${ownerId}
          and (nullif(trim(p.yarn_brand), '') is not null or nullif(trim(p.yarn_type), '') is not null or nullif(trim(p.yarn_color), '') is not null)
          and not exists (select 1 from ${projectYarnsTable} y where y.project_id = p.id)
      `);
      await tx
        .update(projectsTable)
        .set({ yarnBrand: null, yarnType: null, yarnColor: null })
        .where(and(eq(projectsTable.ownerId, ownerId), hasOldYarn));
    });
  }
  cleanOwners.add(ownerId);
}

// Finishing a project offers to take each linked stash yarn's skeins off
// what's left. A yarn already offered for this project isn't offered again.
export async function suggestSkeinsLeft(tx: Transaction, ownerId: string, projectId: string): Promise<void> {
  const used = await tx
    .select({
      stashYarnId: projectYarnsTable.stashYarnId,
      skeinsUsed: sql<number>`sum(${projectYarnsTable.skeinsUsed})`.mapWith(Number),
    })
    .from(projectYarnsTable)
    .where(and(eq(projectYarnsTable.projectId, projectId), sql`${projectYarnsTable.stashYarnId} is not null`, sql`${projectYarnsTable.skeinsUsed} > 0`))
    .groupBy(projectYarnsTable.stashYarnId);
  if (used.length === 0) return;
  await tx
    .insert(skeinSuggestionsTable)
    .values(used.map((row) => ({ ownerId, projectId, stashYarnId: row.stashYarnId!, skeinsUsed: row.skeinsUsed })))
    .onConflictDoNothing({ target: [skeinSuggestionsTable.stashYarnId, skeinSuggestionsTable.projectId] });
}

// Reopening a finished project withdraws the suggestions still waiting.
export async function withdrawSkeinSuggestions(tx: Transaction, projectId: string): Promise<void> {
  await tx
    .delete(skeinSuggestionsTable)
    .where(and(eq(skeinSuggestionsTable.projectId, projectId), eq(skeinSuggestionsTable.status, "pending")));
}

export function skeinsAfter(left: number, used: number): number {
  return Math.max(0, Math.round((left - used) * 2) / 2);
}
