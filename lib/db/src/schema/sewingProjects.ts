import {
  date,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectStatusEnum } from "./projects";
import { stashFabricsTable } from "./fabricStash";

// The stage a sewing project has reached, in the order they happen.
export const sewingStageEnum = pgEnum("sewing_stage", ["prep", "cut", "sew", "fit", "finish"]);

// Sewing projects live in the Sewing room, apart from yarn projects, so yarn
// pages never have to filter them out.
export const sewingProjectsTable = pgTable("sewing_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: projectStatusEnum("status").notNull().default("planning"),
  stage: sewingStageEnum("stage").notNull().default("prep"),
  patternName: text("pattern_name"),
  patternDesigner: text("pattern_designer"),
  sizeMade: text("size_made"),
  fitChanges: text("fit_changes"),
  notes: text("notes"),
  // Set when the project is marked finished, cleared if it is reopened.
  completedAt: date("completed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Stash fabric used by a sewing project. The amount is in the fabric's own
// unit (meters or yards). Removing the fabric from the stash removes the link.
export const sewingProjectFabricsTable = pgTable("sewing_project_fabrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => sewingProjectsTable.id, { onDelete: "cascade" }),
  stashFabricId: uuid("stash_fabric_id")
    .notNull()
    .references(() => stashFabricsTable.id, { onDelete: "cascade" }),
  amountUsed: doublePrecision("amount_used"),
  position: integer("position").notNull().default(0),
});

export type SewingProject = typeof sewingProjectsTable.$inferSelect;
export type SewingProjectFabric = typeof sewingProjectFabricsTable.$inferSelect;
