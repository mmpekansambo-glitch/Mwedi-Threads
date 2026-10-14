import {
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  craft: craftTypeEnum("craft").notNull(),
  status: projectStatusEnum("status").notNull().default("planning"),
  description: text("description"),
  patternName: text("pattern_name"),
  patternDesigner: text("pattern_designer"),
  yarn: text("yarn"),
  yarnBrand: text("yarn_brand"),
  yarnType: text("yarn_type"),
  yarnColor: text("yarn_color"),
  tools: text("tools"),
  startedAt: date("started_at", { mode: "string" }),
  startedAtPrecision: projectDatePrecisionEnum("started_at_precision")
    .notNull()
    .default("day"),
  targetDate: date("target_date", { mode: "string" }),
  targetDatePrecision: projectDatePrecisionEnum("target_date_precision")
    .notNull()
    .default("day"),
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
