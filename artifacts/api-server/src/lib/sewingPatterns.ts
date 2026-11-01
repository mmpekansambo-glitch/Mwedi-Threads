import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, sewingPatternsTable, sewingProjectsTable } from "@workspace/db";
import { matchKey } from "./yarnCatalog";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pattern photos live under the owner's own folder, so a pattern can only
// point at a photo its owner uploaded.
export function isOwnPatternPhoto(ownerId: string, photoPath: string): boolean {
  return new RegExp(`^/objects/sewing-patterns/${escapeForRegExp(ownerId)}/[0-9a-f-]{36}$`, "i").test(photoPath);
}

// Two patterns are the same when name and designer match, ignoring case,
// spaces and punctuation.
export function samePattern(
  a: { name: string; designer: string | null },
  b: { name: string; designer: string | null },
): boolean {
  return matchKey(a.name) === matchKey(b.name) && matchKey(a.designer ?? "") === matchKey(b.designer ?? "");
}

// Finds the maker's pattern with this name and designer, or adds it to their
// pattern stash, and returns its id.
export async function findOrAddPattern(
  ownerId: string,
  name: string,
  designer: string | null,
  conn: Db | Tx = db,
): Promise<string> {
  const wanted = { name: name.trim().replace(/\s+/g, " "), designer: designer?.trim().replace(/\s+/g, " ") || null };
  const own = await conn
    .select({ id: sewingPatternsTable.id, name: sewingPatternsTable.name, designer: sewingPatternsTable.designer })
    .from(sewingPatternsTable)
    .where(eq(sewingPatternsTable.ownerId, ownerId));
  const match = own.find((pattern) => samePattern(pattern, wanted));
  if (match) return match.id;
  const [created] = await conn
    .insert(sewingPatternsTable)
    .values({ ownerId, name: wanted.name, designer: wanted.designer })
    .returning({ id: sewingPatternsTable.id });
  return created!.id;
}

const movedOwners = new Set<string>();

// Sewing projects saved before the pattern stash have a typed pattern name.
// The first time a maker's sewing room is loaded, each one is matched to the
// pattern stash or added to it, and the typed copy is cleared.
export async function moveTypedPatterns(ownerId: string): Promise<void> {
  if (movedOwners.has(ownerId)) return;
  const typed = and(
    eq(sewingProjectsTable.ownerId, ownerId),
    isNull(sewingProjectsTable.patternId),
    isNotNull(sewingProjectsTable.patternName),
  );
  const [waiting] = await db.select({ id: sewingProjectsTable.id }).from(sewingProjectsTable).where(typed).limit(1);
  if (waiting) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`sewing-patterns:${ownerId}`}))`);
      const rows = await tx
        .select({ id: sewingProjectsTable.id, name: sewingProjectsTable.patternName, designer: sewingProjectsTable.patternDesigner })
        .from(sewingProjectsTable)
        .where(typed);
      for (const row of rows) {
        const name = row.name?.trim();
        const patternId = name ? await findOrAddPattern(ownerId, name, row.designer, tx) : null;
        await tx
          .update(sewingProjectsTable)
          .set({ patternId, patternName: null, patternDesigner: null, updatedAt: sql`${sewingProjectsTable.updatedAt}` })
          .where(eq(sewingProjectsTable.id, row.id));
      }
    });
  }
  movedOwners.add(ownerId);
}
