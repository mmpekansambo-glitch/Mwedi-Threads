import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { stashYarnsTable } from "./yarnStash";

// Every yarn a project uses, in the order the maker listed them. A yarn in
// several colors gets one row per color. Rows linked to the stash copy the
// stash yarn's names when the project is saved.
export const projectYarnsTable = pgTable("project_yarns", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  stashYarnId: uuid("stash_yarn_id").references(() => stashYarnsTable.id, {
    onDelete: "set null",
  }),
  brand: text("brand"),
  subBrand: text("sub_brand"),
  color: text("color"),
  // Worked as one strand with the yarn listed just above it.
  heldTogether: boolean("held_together").notNull().default(false),
  skeinsUsed: doublePrecision("skeins_used"),
});

export const skeinSuggestionStatusEnum = pgEnum("skein_suggestion_status", [
  "pending",
  "accepted",
  "dismissed",
]);

// When a project is finished, each linked stash yarn gets a suggestion to
// take the project's skeins off what's left. The maker confirms or dismisses.
export const skeinSuggestionsTable = pgTable(
  "skein_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    stashYarnId: uuid("stash_yarn_id")
      .notNull()
      .references(() => stashYarnsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    skeinsUsed: doublePrecision("skeins_used").notNull(),
    status: skeinSuggestionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("skein_suggestions_yarn_project").on(table.stashYarnId, table.projectId),
  ],
);

export type ProjectYarn = typeof projectYarnsTable.$inferSelect;
export type SkeinSuggestion = typeof skeinSuggestionsTable.$inferSelect;
