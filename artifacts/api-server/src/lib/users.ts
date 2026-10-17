import { clerkClient } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

type ClerkProfile = { email: string | null; displayName: string | null };

// People whose users row already has their details, so later requests in
// this server process skip the database check.
const completeUserIds = new Set<string>();

async function loadClerkProfile(userId: string): Promise<ClerkProfile | null> {
  if (!process.env.CLERK_SECRET_KEY) return null;
  try {
    const user = await clerkClient.users.getUser(userId);
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return {
      email: user.primaryEmailAddress?.emailAddress ?? null,
      displayName: fullName || user.username || null,
    };
  } catch (error) {
    logger.warn({ err: error, userId }, "Could not load the Clerk profile");
    return null;
  }
}

// Makes sure the signed-in person has a users row, creating it on their
// first request. Email and display name come from Clerk; if Clerk can't be
// reached they stay empty and are filled in on a later request.
export async function ensureUserRow(userId: string): Promise<void> {
  if (completeUserIds.has(userId)) return;

  const [existing] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (existing?.email) {
    completeUserIds.add(userId);
    return;
  }

  const profile = await loadClerkProfile(userId);
  await db
    .insert(usersTable)
    .values({
      id: userId,
      email: profile?.email ?? null,
      displayName: profile?.displayName ?? null,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        email: sql`coalesce(excluded.email, ${usersTable.email})`,
        displayName: sql`coalesce(excluded.display_name, ${usersTable.displayName})`,
      },
    });
  if (profile?.email) completeUserIds.add(userId);
}

export function forgetCompleteUsersForTests(): void {
  completeUserIds.clear();
}
