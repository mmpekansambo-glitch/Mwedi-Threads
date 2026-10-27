import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Notions get used up (zips, buttons, thread); kit stays (machines, scissors).
export const sewingToolSectionEnum = pgEnum("sewing_tool_section", ["notions", "kit"]);

export const sewingToolCategoryEnum = pgEnum("sewing_tool_category", [
  "zip",
  "button",
  "elastic",
  "thread",
  "interfacing",
  "machine",
  "presser_foot",
  "needle",
  "scissors",
  "ruler",
  "other",
]);

// One row per notion or piece of kit in a maker's Sewing room. The photo is
// optional and private to its owner.
export const sewingToolsTable = pgTable("sewing_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  section: sewingToolSectionEnum("section").notNull(),
  category: sewingToolCategoryEnum("category").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity"),
  size: text("size"),
  color: text("color"),
  brand: text("brand"),
  notes: text("notes"),
  photoPath: text("photo_path"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SewingTool = typeof sewingToolsTable.$inferSelect;
