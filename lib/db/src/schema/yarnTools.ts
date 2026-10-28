import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const yarnToolSectionEnum = pgEnum("yarn_tool_section", ["hooks", "needles", "notions"]);

export const yarnToolMaterialEnum = pgEnum("yarn_tool_material", [
  "aluminium",
  "steel",
  "bamboo",
  "wood",
  "plastic",
  "ergonomic",
]);

export const yarnNotionTypeEnum = pgEnum("yarn_notion_type", [
  "stitch_markers",
  "tapestry_needles",
  "row_counter",
  "cable_needles",
  "scissors",
  "measuring_tape",
  "blocking_mats",
  "blocking_pins",
  "yarn_swift",
  "ball_winder",
  "other",
]);

// One row per hook, needle or notion a maker owns in their Yarn studio.
// Hooks and needles use the same size lists as projects; needle type and
// cable length only apply to needles, and notion type only to notions. The
// photo is optional and private to its owner.
export const yarnToolsTable = pgTable("yarn_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  section: yarnToolSectionEnum("section").notNull(),
  size: text("size"),
  needleType: text("needle_type"),
  cableLength: text("cable_length"),
  material: yarnToolMaterialEnum("material"),
  notionType: yarnNotionTypeEnum("notion_type"),
  name: text("name"),
  quantity: integer("quantity"),
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

export type YarnTool = typeof yarnToolsTable.$inferSelect;
