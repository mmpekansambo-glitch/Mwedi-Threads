import {
  doublePrecision,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Standard yarn weights, thinnest to thickest.
export const yarnWeightEnum = pgEnum("yarn_weight", [
  "lace",
  "fingering",
  "sport",
  "dk",
  "worsted",
  "bulky",
  "super_bulky",
  "jumbo",
]);

// The general color behind a yarn's own color name, shown as a dot.
export const generalColorEnum = pgEnum("general_color", [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "brown",
  "black",
  "gray",
  "white",
  "cream",
  "multi",
]);

export type YarnBlendPart = { fiber: string; percent: number };

// The shared catalog is built from what makers add to their stash. Each
// name has a match key (lowercase letters and digits only), so "Lion Brand"
// and "lionbrand" land on the same row instead of making a duplicate.
export const yarnBrandsTable = pgTable(
  "yarn_brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    matchKey: text("match_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("yarn_brands_match_key").on(table.matchKey)],
);

// A brand's product lines ("sub brands"). Blend and link come from the first
// maker who adds the line and pre-fill the form for the next one.
export const yarnLinesTable = pgTable(
  "yarn_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => yarnBrandsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    matchKey: text("match_key").notNull(),
    blend: jsonb("blend").$type<YarnBlendPart[]>().notNull().default([]),
    link: text("link"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("yarn_lines_brand_match_key").on(table.brandId, table.matchKey)],
);

// A line's real color names, e.g. "Fisherman" or "Cranberry".
export const yarnColorsTable = pgTable(
  "yarn_colors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lineId: uuid("line_id")
      .notNull()
      .references(() => yarnLinesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    matchKey: text("match_key").notNull(),
    generalColor: generalColorEnum("general_color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("yarn_colors_line_match_key").on(table.lineId, table.matchKey)],
);

// One row per yarn in a maker's stash. The names are copied from the shared
// catalog when the yarn is saved; the photo stays private to its owner.
export const stashYarnsTable = pgTable("stash_yarns", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => yarnBrandsTable.id),
  lineId: uuid("line_id").references(() => yarnLinesTable.id),
  colorId: uuid("color_id").references(() => yarnColorsTable.id),
  brand: text("brand").notNull(),
  subBrand: text("sub_brand"),
  color: text("color"),
  generalColor: generalColorEnum("general_color"),
  weight: yarnWeightEnum("weight"),
  blend: jsonb("blend").$type<YarnBlendPart[]>().notNull().default([]),
  brandLink: text("brand_link"),
  photoPath: text("photo_path").notNull(),
  skeinsPurchased: doublePrecision("skeins_purchased"),
  skeinsLeft: doublePrecision("skeins_left"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type YarnBrand = typeof yarnBrandsTable.$inferSelect;
export type YarnLine = typeof yarnLinesTable.$inferSelect;
export type YarnColor = typeof yarnColorsTable.$inferSelect;
export type StashYarn = typeof stashYarnsTable.$inferSelect;
