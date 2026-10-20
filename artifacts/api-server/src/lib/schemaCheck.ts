import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { pool } from "@workspace/db";
import * as schema from "@workspace/db/schema";
import { logger } from "./logger";

export type TableColumns = Map<string, Set<string>>;

// Every table and column the code expects, read from the Drizzle schema.
export function expectedTables(tables: Record<string, unknown> = schema): TableColumns {
  const expected: TableColumns = new Map();
  for (const value of Object.values(tables)) {
    if (!is(value, PgTable)) continue;
    const columns = Object.values(getTableColumns(value)).map((column) => column.name);
    expected.set(getTableName(value), new Set(columns));
  }
  return expected;
}

export function findMissing(expected: TableColumns, actual: TableColumns) {
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const [table, columns] of expected) {
    const found = actual.get(table);
    if (!found) {
      missingTables.push(table);
      continue;
    }
    for (const column of columns) {
      if (!found.has(column)) missingColumns.push(`${table}.${column}`);
    }
  }
  return { missingTables, missingColumns };
}

// Logs a clear error when the database is behind the code, which happens when a
// pull into Replit doesn't run the db push in scripts/post-merge.sh.
export async function checkDatabaseSchema() {
  try {
    const result = await pool.query<{ table_name: string; column_name: string }>(
      "select table_name, column_name from information_schema.columns where table_schema = 'public'",
    );
    const actual: TableColumns = new Map();
    for (const row of result.rows) {
      if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
      actual.get(row.table_name)!.add(row.column_name);
    }
    const { missingTables, missingColumns } = findMissing(expectedTables(), actual);
    if (missingTables.length === 0 && missingColumns.length === 0) {
      logger.info("Database schema matches the code");
      return;
    }
    logger.error(
      { missingTables, missingColumns },
      "Database is missing tables or columns the code needs. Run `pnpm --filter db run prepare-users` then `pnpm --filter db push` in Replit dev, then publish and approve the database changes.",
    );
  } catch (err) {
    logger.error({ err }, "Could not check the database schema");
  }
}
