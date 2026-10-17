import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

// One row means "this user starred this project". The pair is the key, so a
// project can only be starred once per person.
export const starsTable = pgTable(
  "stars",
  {
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.projectId] })],
);

export type Star = typeof starsTable.$inferSelect;
