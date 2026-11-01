import { pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const studioEnum = pgEnum("studio", ["yarn", "sewing"]);

// The weekly crafting goal counts days. A day fills in from a journal note,
// a row counter tap or the "I crafted today" button. Notes still on a project
// are read straight from the journals; this table keeps the rest, plus the
// hour each note was first written, so deleting a note keeps its day.
// One row per hour is enough to place it on the maker's own calendar day,
// and stops every counter tap adding a row.
export const craftActivityTable = pgTable(
  "craft_activity",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    studio: studioEnum("studio").notNull(),
    hour: timestamp("hour", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.studio, table.hour] })],
);

export type CraftActivity = typeof craftActivityTable.$inferSelect;
