import { and, eq } from "drizzle-orm";
import {
  db,
  yarnBrandsTable,
  yarnColorsTable,
  yarnLinesTable,
  type StashYarn,
} from "@workspace/db";
import { matchKey, tidyName, type BlendPart } from "./yarnCatalog";

type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type GeneralColor = NonNullable<StashYarn["generalColor"]>;

export type CatalogInput = {
  brand: string;
  subBrand: string | null;
  color: string | null;
  generalColor: GeneralColor | null;
  blend: BlendPart[];
  brandLink: string | null;
};

// Adds the yarn's brand, sub brand and color to the shared catalog, or finds
// the entries that already match, and returns the catalog's own spelling.
// The first maker to add a sub brand or color sets its blend, link and
// general color; later makers only fill in what is still missing.
export async function addToCatalog(tx: Transaction, input: CatalogInput) {
  const brandName = tidyName(input.brand);
  await tx
    .insert(yarnBrandsTable)
    .values({ name: brandName, matchKey: matchKey(brandName) })
    .onConflictDoNothing({ target: yarnBrandsTable.matchKey });
  const [brand] = await tx
    .select()
    .from(yarnBrandsTable)
    .where(eq(yarnBrandsTable.matchKey, matchKey(brandName)));

  const lineName = input.subBrand ? tidyName(input.subBrand) : "";
  let line: typeof yarnLinesTable.$inferSelect | undefined;
  if (matchKey(lineName)) {
    await tx
      .insert(yarnLinesTable)
      .values({
        brandId: brand.id,
        name: lineName,
        matchKey: matchKey(lineName),
        blend: input.blend,
        link: input.brandLink,
      })
      .onConflictDoNothing({ target: [yarnLinesTable.brandId, yarnLinesTable.matchKey] });
    [line] = await tx
      .select()
      .from(yarnLinesTable)
      .where(and(eq(yarnLinesTable.brandId, brand.id), eq(yarnLinesTable.matchKey, matchKey(lineName))));
    const missing = {
      ...(line.blend.length === 0 && input.blend.length ? { blend: input.blend } : {}),
      ...(!line.link && input.brandLink ? { link: input.brandLink } : {}),
    };
    if (Object.keys(missing).length) {
      [line] = await tx.update(yarnLinesTable).set(missing).where(eq(yarnLinesTable.id, line.id)).returning();
    }
  }

  const colorName = input.color ? tidyName(input.color) : "";
  let color: typeof yarnColorsTable.$inferSelect | undefined;
  if (line && matchKey(colorName)) {
    await tx
      .insert(yarnColorsTable)
      .values({
        lineId: line.id,
        name: colorName,
        matchKey: matchKey(colorName),
        generalColor: input.generalColor,
      })
      .onConflictDoNothing({ target: [yarnColorsTable.lineId, yarnColorsTable.matchKey] });
    [color] = await tx
      .select()
      .from(yarnColorsTable)
      .where(and(eq(yarnColorsTable.lineId, line.id), eq(yarnColorsTable.matchKey, matchKey(colorName))));
    if (!color.generalColor && input.generalColor) {
      [color] = await tx
        .update(yarnColorsTable)
        .set({ generalColor: input.generalColor })
        .where(eq(yarnColorsTable.id, color.id))
        .returning();
    }
  }

  return {
    brandId: brand.id,
    brand: brand.name,
    lineId: line?.id ?? null,
    subBrand: line?.name ?? null,
    colorId: color?.id ?? null,
    color: color?.name ?? (matchKey(colorName) ? colorName : null),
  };
}
