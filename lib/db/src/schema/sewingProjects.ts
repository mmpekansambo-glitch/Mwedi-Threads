import {
  date,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectStatusEnum } from "./projects";
import { stashFabricsTable } from "./fabricStash";
import { generalColorEnum } from "./yarnStash";
import { sewingToolsTable } from "./sewingTools";
import { skeinSuggestionStatusEnum } from "./projectYarns";

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

// When a sewing project is finished, each linked fabric with an amount used
// gets a suggestion to take it off what's left. The maker confirms or dismisses.
export const fabricSuggestionsTable = pgTable(
  "fabric_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    stashFabricId: uuid("stash_fabric_id")
      .notNull()
      .references(() => stashFabricsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => sewingProjectsTable.id, { onDelete: "cascade" }),
    amountUsed: doublePrecision("amount_used").notNull(),
    status: skeinSuggestionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("fabric_suggestions_fabric_project").on(table.stashFabricId, table.projectId),
  ],
);

export type SewingProject = typeof sewingProjectsTable.$inferSelect;
export type SewingProjectFabric = typeof sewingProjectFabricsTable.$inferSelect;
export type FabricSuggestion = typeof fabricSuggestionsTable.$inferSelect;
