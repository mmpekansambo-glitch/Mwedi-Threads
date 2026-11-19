// Copies every row from the app's current database into another one, for the
// move from Replit to Supabase.
//
//   From: DATABASE_URL (the database this Replit workspace or deployment uses)
//   To:   COPY_TO_DATABASE_URL (the Supabase database)
//
// Before running it, give the target the app's tables:
//   DATABASE_URL="$COPY_TO_DATABASE_URL" pnpm --filter db push
// then:
//   pnpm --filter db run copy-database
//
// The source is only read. The target must be empty, unless you pass
// --replace, which first empties every target table (use it to copy again
// after a trial run). Everything is written in one transaction, so a failure
// leaves the target exactly as it was.
import pg from "pg";
import { clientConfig } from "./connection.mjs";

const BATCH_SIZE = 200;

const sourceUrl = process.env.DATABASE_URL;
const targetUrl = process.env.COPY_TO_DATABASE_URL;
const replace = process.argv.includes("--replace");

if (!sourceUrl) throw new Error("DATABASE_URL (the database to copy from) is not set.");
if (!targetUrl) throw new Error("COPY_TO_DATABASE_URL (the database to copy into) is not set.");
if (sourceUrl === targetUrl) throw new Error("The source and target are the same database.");

const quote = (name) => `"${name.replaceAll('"', '""')}"`;

async function tableColumns(client) {
  const { rows } = await client.query(`
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.is_generated = 'NEVER'
    ORDER BY c.table_name, c.ordinal_position
  `);
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.table_name)) tables.set(row.table_name, []);
    tables.get(row.table_name).push(row.column_name);
  }
  return tables;
}

// Parents before children, so every foreign key finds its row.
async function copyOrder(client, tableNames) {
  const { rows } = await client.query(`
    SELECT child.relname AS child, parent.relname AS parent
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    WHERE con.contype = 'f' AND ns.nspname = 'public'
  `);
  const parents = new Map(tableNames.map((name) => [name, new Set()]));
  for (const { child, parent } of rows) {
    if (child !== parent && parents.has(child) && parents.has(parent)) parents.get(child).add(parent);
  }
  const ordered = [];
  const done = new Set();
  while (ordered.length < tableNames.length) {
    const ready = tableNames.filter((name) => !done.has(name) && [...parents.get(name)].every((p) => done.has(p)));
    if (ready.length === 0) throw new Error("Tables refer to each other in a loop; cannot pick a copy order.");
    for (const name of ready.sort()) {
      ordered.push(name);
      done.add(name);
    }
  }
  return ordered;
}

async function countRows(client, table) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${quote(table)}`);
  return rows[0].n;
}

const source = new pg.Client(clientConfig(sourceUrl));
const target = new pg.Client(clientConfig(targetUrl));
await source.connect();
await target.connect();

try {
  const sourceTables = await tableColumns(source);
  const targetTables = await tableColumns(target);
  if (targetTables.size === 0) {
    throw new Error('The target has no tables yet. Run: DATABASE_URL="$COPY_TO_DATABASE_URL" pnpm --filter db push');
  }

  const missing = [...sourceTables.keys()].filter((name) => !targetTables.has(name));
  if (missing.length > 0) {
    throw new Error(`The target is missing tables the source has: ${missing.join(", ")}. Run db push against the target first.`);
  }

  const order = await copyOrder(target, [...targetTables.keys()]);

  if (!replace) {
    for (const table of order) {
      if ((await countRows(target, table)) > 0) {
        throw new Error(`The target table ${table} already has rows. Pass --replace to empty the target and copy again.`);
      }
    }
  }

  // A consistent snapshot of the source while it is read.
  await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await target.query("BEGIN");

  if (replace) {
    await target.query(`TRUNCATE ${order.map(quote).join(", ")} CASCADE`);
    console.log("Emptied the target tables.");
  }

  const report = [];
  for (const table of order) {
    if (!sourceTables.has(table)) {
      report.push({ table, copied: 0, note: "not in source" });
      continue;
    }
    // Only columns both sides have; a column the source lacks keeps its default.
    const sourceColumns = new Set(sourceTables.get(table));
    const columns = targetTables.get(table).filter((column) => sourceColumns.has(column));
    const columnList = columns.map(quote).join(", ");

    const { rows } = await source.query(`SELECT row_to_json(t)::text AS row FROM ${quote(table)} t`);
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = `[${rows.slice(start, start + BATCH_SIZE).map((r) => r.row).join(",")}]`;
      await target.query(
        `INSERT INTO ${quote(table)} (${columnList})
         SELECT ${columnList} FROM json_populate_recordset(NULL::${quote(table)}, $1::json)`,
        [batch],
      );
    }
    const copied = await countRows(target, table);
    if (copied !== rows.length) throw new Error(`${table}: read ${rows.length} rows but the target has ${copied}.`);
    report.push({ table, copied });
  }

  // Counters behind serial/identity columns continue after the copied rows.
  const { rows: sequences } = await target.query(`
    SELECT c.table_name, c.column_name, pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) AS seq
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND pg_get_serial_sequence(quote_ident(c.table_name), c.column_name) IS NOT NULL
  `);
  for (const { table_name, column_name, seq } of sequences) {
    await target.query(
      `SELECT setval($1, COALESCE((SELECT max(${quote(column_name)}) FROM ${quote(table_name)}), 0) + 1, false)`,
      [seq],
    );
  }

  await target.query("COMMIT");
  await source.query("COMMIT");
  console.table(report);
  console.log(`Copied ${report.reduce((sum, r) => sum + r.copied, 0)} rows into ${report.length} tables.`);
} catch (error) {
  await target.query("ROLLBACK").catch(() => undefined);
  await source.query("ROLLBACK").catch(() => undefined);
  console.error("Nothing was changed in the target.");
  throw error;
} finally {
  await source.end();
  await target.end();
}
