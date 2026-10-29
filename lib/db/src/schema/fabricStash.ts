import { sql } from "drizzle-orm";
import {
  boolean,
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
  "canvas",
  "chambray",
  "chiffon",
  "corduroy",
  "crepe",
  "flannel",
  "fleece",
  "french_terry",
  "rib_knit",
  "satin",
  "tulle",
  "velvet",
  "viscose",
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
  "ankara",
  "batik",
  "botanical",
  "camo",
  "chevron",
  "damask",
  "houndstooth",
  "ikat",
  "ombre",
  "paisley",
  "tie_dye",
  "toile",
  "other",
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
  // How much was bought, and how much of it is still in the stash.
  amount: doublePrecision("amount"),
  amountLeft: doublePrecision("amount_left"),
  width: doublePrecision("width"),
  // Left empty when the maker hasn't said; washing shrinks fabric, so this
  // tells them whether the amount and width are before or after.
  preWashed: boolean("pre_washed"),
  // No longer asked for. Kept until every saved brand has moved into the
  // notes (the API does that the first time a maker's fabric loads).
  brand: text("brand"),
  notes: text("notes"),
  photoPaths: text("photo_paths").array().notNull().default(sql`'{}'::text[]`),
  // Set when the maker moves used-up fabric to their Archive.
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type StashFabric = typeof stashFabricsTable.$inferSelect;
