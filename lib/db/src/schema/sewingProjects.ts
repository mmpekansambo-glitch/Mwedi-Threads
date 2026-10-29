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
import { generalColorEnum } from "./yarnStash";
import { sewingToolsTable } from "./sewingTools";

// The stage a sewing project has reached, in the order they happen.
export const sewingStageEnum = pgEnum("sewing_stage", ["prep", "cut", "sew", "fit", "finish"]);

export const sewingNeedleTypeEnum = pgEnum("sewing_needle_type", [
  "universal",
  "ballpoint",
  "stretch",
  "jeans",
  "microtex",
  "quilting",
  "leather",
  "topstitch",
  "embroidery",
  "metallic",
]);

export const sewingStitchEnum = pgEnum("sewing_stitch", [
  "straight",
  "zigzag",
  "three_step_zigzag",
  "stretch",
  "overlock",
  "blind_hem",
  "buttonhole",
  "decorative",
]);

export const sewingPresserFootEnum = pgEnum("sewing_presser_foot", [
  "all_purpose",
  "zipper",
  "walking",
  "buttonhole",
  "blind_hem",
  "rolled_hem",
  "quarter_inch",
  "open_toe",
  "non_stick",
]);

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
  needleType: sewingNeedleTypeEnum("needle_type"),
  // Metric/US pair such as "75/11"; the API keeps it to the listed sizes.
  needleSize: text("needle_size"),
  threadColor: generalColorEnum("thread_color"),
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

// Tools (notions or kit) a project uses. Just a list: nothing is counted.
export const sewingProjectToolsTable = pgTable("sewing_project_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => sewingProjectsTable.id, { onDelete: "cascade" }),
  sewingToolId: uuid("sewing_tool_id")
    .notNull()
    .references(() => sewingToolsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

// Named machine settings a project uses, such as Seams, Topstitch or Hem.
// Every part is optional; the API turns away a set with nothing in it.
export const sewingProjectMachineSettingsTable = pgTable("sewing_project_machine_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => sewingProjectsTable.id, { onDelete: "cascade" }),
  name: text("name"),
  stitch: sewingStitchEnum("stitch"),
  // In mm, in half steps.
  stitchLength: doublePrecision("stitch_length"),
  stitchWidth: doublePrecision("stitch_width"),
  tension: doublePrecision("tension"),
  presserFoot: sewingPresserFootEnum("presser_foot"),
  notes: text("notes"),
  position: integer("position").notNull().default(0),
});

// Dated notes in a sewing project's journal, newest first on the page.
export const sewingProjectEntriesTable = pgTable("sewing_project_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => sewingProjectsTable.id, { onDelete: "cascade" }),
  notes: text("notes").notNull(),
  // When the note was written; the maker can move it to another day.
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SewingProject = typeof sewingProjectsTable.$inferSelect;
export type SewingProjectFabric = typeof sewingProjectFabricsTable.$inferSelect;
export type SewingProjectMachineSetting = typeof sewingProjectMachineSettingsTable.$inferSelect;
export type SewingProjectEntry = typeof sewingProjectEntriesTable.$inferSelect;
