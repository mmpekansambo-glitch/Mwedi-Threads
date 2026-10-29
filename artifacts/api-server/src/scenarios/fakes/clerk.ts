// Stands in for @clerk/express in the scenario stories: the signed-in maker
// is whoever the x-test-user header names, and their Clerk profile is made up
// from that id, so the first request creates the users row as it does live.
import type { Request } from "express";

export function getAuth(req: Request) {
  const userId = req.headers["x-test-user"];
  return { userId: typeof userId === "string" && userId ? userId : null };
}

export const clerkClient = {
  users: {
    getUser: async (userId: string) => ({
      firstName: userId,
      lastName: null,
      username: null,
      primaryEmailAddress: { emailAddress: `${userId}@example.test` },
    }),
  },
};
