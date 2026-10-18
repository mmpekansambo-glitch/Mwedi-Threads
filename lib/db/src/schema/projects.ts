import {
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const craftTypeEnum = pgEnum("craft_type", ["knitting", "crochet"]);
export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "in_progress",
  "paused",
  "completed",
]);
export const projectDatePrecisionEnum = pgEnum("project_date_precision", [
  "month",
  "day",
]);

export const progressMethodEnum = pgEnum("progress_method", [
  "estimate",
  "rows",
  "sections",
  "skeins",
]);

export type ProgressSection = { name: string; done: boolean };

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.id),
  title: text("title").notNull(),
  craft: craftTypeEnum("craft").notNull(),
  status: projectStatusEnum("status").notNull().default("planning"),
  description: text("description"),
  patternName: text("pattern_name"),
  patternDesigner: text("pattern_designer"),
  designerWebsite: text("designer_website"),
  designerPageTitle: text("designer_page_title"),
  yarn: text("yarn"),
  yarnBrand: text("yarn_brand"),
  yarnType: text("yarn_type"),
  yarnColor: text("yarn_color"),
  tools: text("tools"),
  hookSize: text("hook_size"),
  startedAt: date("started_at", { mode: "string" }),
  startedAtPrecision: projectDatePrecisionEnum("started_at_precision")
    .notNull()
    .default("day"),
  targetDate: date("target_date", { mode: "string" }),
  targetDatePrecision: projectDatePrecisionEnum("target_date_precision")
    .notNull()
    .default("day"),
  completedAt: date("completed_at", { mode: "string" }),
  completedAtPrecision: projectDatePrecisionEnum("completed_at_precision")
    .notNull()
    .default("day"),
  progressMethod: progressMethodEnum("progress_method")
    .notNull()
    .default("estimate"),
  // Total rows or rounds, or skeins planned (halves allowed).
  progressTotal: doublePrecision("progress_total"),
  progressSections: jsonb("progress_sections")
    .$type<ProgressSection[]>()
    .notNull()
    .default([]),
  completionPercent: integer("completion_percent").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const progressEntriesTable = pgTable("project_progress_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  notes: text("notes").notNull(),
  photoPath: text("photo_path"),
  completionPercent: integer("completion_percent").notNull(),
  // Row or round reached, or skeins used, for projects that track those.
  progressValue: doublePrecision("progress_value"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
export type ProgressEntry = typeof progressEntriesTable.$inferSelect;
