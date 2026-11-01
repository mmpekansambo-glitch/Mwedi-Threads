import { sql } from "drizzle-orm";
import { craftActivityTable, db } from "@workspace/db";
import type { Studio } from "./weeklyGoal";

type Executor = Pick<typeof db, "insert">;

// Marks the hour as crafting time for the weekly goal. Repeat taps in the same
// hour do nothing. Never lets a failure here stop the note or counter saving.
export async function recordCraftActivity(userId: string, studio: Studio, at: Date = new Date(), executor: Executor = db) {
  try {
    await executor
      .insert(craftActivityTable)
      .values({ userId, studio, hour: sql`date_trunc('hour', ${at.toISOString()}::timestamptz)` })
      .onConflictDoNothing();
  } catch {
    // The goal card is a nice-to-have; the maker's own save matters more.
  }
}
