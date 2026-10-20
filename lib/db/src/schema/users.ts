import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per person who has signed in. The id is the Clerk user ID, so it
// matches what Clerk sends with every request. Email and display name are
// copied from Clerk and can be empty until the next time the person visits.
// The craft switches decide which homes (Yarn studio, Sewing room) a person
// sees. Accounts made before the Sewing room start with yarn only;
// crafts_chosen_at stays empty until the person picks their crafts.
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  yarnEnabled: boolean("yarn_enabled").notNull().default(true),
  sewingEnabled: boolean("sewing_enabled").notNull().default(false),
  craftsChosenAt: timestamp("crafts_chosen_at", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  joinedAt: true,
  yarnEnabled: true,
  sewingEnabled: true,
  craftsChosenAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
