import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const sewingPatternTypeEnum = pgEnum("sewing_pattern_type", [
  "dress",
  "top",
  "shirt",
  "skirt",
  "trousers",
  "shorts",
  "jumpsuit",
  "jacket",
  "coat",
  "knitwear",
  "lingerie",
  "swimwear",
  "activewear",
  "sleepwear",
  "menswear",
  "kids",
  "baby",
  "bag",
  "accessories",
  "quilt",
  "home",
  "costume",
  "other",
]);

export const sewingPatternFormatEnum = pgEnum("sewing_pattern_format", [
  "paper",
  "pdf",
  "magazine",
  "self_drafted",
]);

// One row per sewing pattern in a maker's pattern stash. Patterns are reused,
// not used up, so there is no archive. The cover photo is optional and
// private to its owner.
export const sewingPatternsTable = pgTable("sewing_patterns", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  designer: text("designer"),
  patternType: sewingPatternTypeEnum("pattern_type"),
  format: sewingPatternFormatEnum("format"),
  sizes: text("sizes"),
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

export type SewingPattern = typeof sewingPatternsTable.$inferSelect;
