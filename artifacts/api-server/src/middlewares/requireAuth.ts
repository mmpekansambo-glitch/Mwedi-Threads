import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { ensureUserRow } from "../lib/users";

export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }

  await ensureUserRow(userId);
  res.locals.userId = userId;
  next();
};
