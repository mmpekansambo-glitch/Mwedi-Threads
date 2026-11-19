// One-time tool for leaving Replit: moves every person in the database onto
// the new Clerk account, so they keep all their projects, stash and notes.
//
// Every row is tied to a Clerk user id, and a new Clerk account gives people
// new ids. For each users row this tool finds the person in the new Clerk
// account by email (creating them there if needed, with no password), then
// switches every row that pointed at the old id to the new one. When the
// person signs in with that email (code by email, or Google with the same
// address), Clerk opens that account and everything is there.
//
// Needs: DATABASE_URL (the database to update, e.g. live Supabase) and
// CLERK_SECRET_KEY (the NEW Clerk account's secret key).
// Run:   pnpm --filter db run move-users-to-clerk -- --dry-run   (only report)
//        pnpm --filter db run move-users-to-clerk
// Safe to re-run: people already on the new account are skipped.
import pg from "pg";
import { clientConfig } from "./connection.mjs";

const dryRun = process.argv.includes("--dry-run");
const databaseUrl = process.env.DATABASE_URL;
const clerkKey = process.env.CLERK_SECRET_KEY;
const clerkApi = (process.env.CLERK_API_URL || "https://api.clerk.com").replace(/\/+$/, "");
if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
if (!clerkKey) throw new Error("CLERK_SECRET_KEY (the new Clerk account's secret key) is not set.");

async function clerk(path, init = {}) {
  const response = await fetch(`${clerkApi}/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${clerkKey}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Clerk ${init.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

async function clerkUserForEmail(email, displayName) {
  const found = await clerk(`/users?email_address=${encodeURIComponent(email)}`);
  if (Array.isArray(found) && found.length > 0) return { id: found[0].id, created: false };
  if (dryRun) return { id: "(would be created)", created: true };
  const [firstName, ...rest] = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const user = await clerk("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      skip_password_requirement: true,
      ...(firstName ? { first_name: firstName } : {}),
      ...(rest.length ? { last_name: rest.join(" ") } : {}),
    }),
  });
  return { id: user.id, created: true };
}

const client = new pg.Client(clientConfig(databaseUrl));
await client.connect();

try {
  // Every column that points at users.id.
  const { rows: references } = await client.query(`
    SELECT con.conrelid::regclass::text AS table_name, a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    WHERE con.contype = 'f' AND con.confrelid = 'public.users'::regclass
  `);
  const { rows: userColumns } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name <> 'id'
    ORDER BY ordinal_position
  `);
  const otherColumns = userColumns.map((row) => `"${row.column_name}"`).join(", ");

  const { rows: people } = await client.query(`SELECT id, email, display_name FROM users ORDER BY joined_at`);
  const report = [];

  for (const person of people) {
    if (await clerk(`/users/${encodeURIComponent(person.id)}`)) {
      report.push({ email: person.email, result: "already on the new account" });
      continue;
    }
    if (!person.email) {
      report.push({ email: "(none)", oldId: person.id, result: "SKIPPED: no email to match on" });
      continue;
    }

    const target = await clerkUserForEmail(person.email, person.display_name);
    if (dryRun) {
      report.push({ email: person.email, result: target.created ? "would create and move" : `would move to ${target.id}` });
      continue;
    }

    await client.query("BEGIN");
    try {
      const { rowCount: alreadyThere } = await client.query(`SELECT 1 FROM users WHERE id = $1`, [target.id]);
      if (!alreadyThere) {
        await client.query(`INSERT INTO users (id, ${otherColumns}) SELECT $1, ${otherColumns} FROM users WHERE id = $2`, [target.id, person.id]);
      }
      let moved = 0;
      for (const { table_name, column_name } of references) {
        const result = await client.query(`UPDATE ${table_name} SET "${column_name}" = $1 WHERE "${column_name}" = $2`, [target.id, person.id]);
        moved += result.rowCount;
      }
      await client.query(`DELETE FROM users WHERE id = $1`, [person.id]);
      await client.query("COMMIT");
      report.push({ email: person.email, result: `${target.created ? "created and " : ""}moved ${moved} rows` });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.table(report);
  if (dryRun) console.log("Dry run: nothing was changed.");
} finally {
  await client.end();
}
