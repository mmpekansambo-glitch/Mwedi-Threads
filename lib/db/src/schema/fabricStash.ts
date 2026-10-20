import { sql } from "drizzle-orm";
import {
  doublePrecision,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { generalColorEnum } from "./yarnStash";

export const fabricTypeEnum = pgEnum("fabric_type", [
  "cotton",
  "linen",
  "jersey",
  "denim",
  "silk",
  "wool",
  "polyester",
  "blend",
  "other",
]);

export const fabricConstructionEnum = pgEnum("fabric_construction", ["woven", "knit"]);

export const fabricPrintEnum = pgEnum("fabric_print", [
  "solid",
  "floral",
  "stripe",
  "check",
  "dots",
  "geometric",
  "abstract",
  "animal",
  "novelty",
]);

// Meters go with centimetre widths, yards with inch widths.
export const fabricUnitEnum = pgEnum("fabric_unit", ["meters", "yards"]);

// One row per piece of fabric in a maker's Sewing room stash. Photos are
// private to their owner; the first one is the close-up of the print and the
// rest (up to three) show the piece another way.
export const stashFabricsTable = pgTable("stash_fabrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  fabricType: fabricTypeEnum("fabric_type").notNull(),
  construction: fabricConstructionEnum("construction"),
  print: fabricPrintEnum("print"),
  generalColor: generalColorEnum("general_color"),
  unit: fabricUnitEnum("unit").notNull().default("meters"),
  amount: doublePrecision("amount"),
  width: doublePrecision("width"),
  brand: text("brand"),
  notes: text("notes"),
  photoPaths: text("photo_paths").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type StashFabric = typeof stashFabricsTable.$inferSelect;
