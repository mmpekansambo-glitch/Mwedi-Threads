// One-time tool for leaving Replit: copies every photo the database points
// to from Replit object storage into Supabase Storage. It has to run inside
// Replit, because Replit's storage is only reachable from there.
//
// Needs (all in Replit Secrets / environment):
//   DATABASE_URL               the database whose rows list the photos
//   PRIVATE_OBJECT_DIR         Replit's photo folder (already set by Replit)
//   COPY_TO_SUPABASE_URL       the Supabase project address, https://<id>.supabase.co
//   COPY_TO_SUPABASE_KEY       that project's secret (service role) key
//   SUPABASE_STORAGE_BUCKET    optional, "photos" unless set
//
// Run:  pnpm --filter @workspace/api-server run copy-photos
//       add --dry-run to only count the photos.
//
// The COPY_TO_ names are deliberate: setting SUPABASE_URL in Replit would
// switch the running Replit app over to Supabase Storage before the move.
//
// Photos keep the same path, so copied database rows keep working. Copying
// again overwrites with the same file, so it is safe to re-run. Replit
// storage is only read.
import pg from "pg";

const dryRun = process.argv.includes("--dry-run");
const CONCURRENCY = 4;

const databaseUrl = process.env.DATABASE_URL;
const privateDir = process.env.PRIVATE_OBJECT_DIR;
const supabaseUrl = process.env.COPY_TO_SUPABASE_URL?.trim().replace(/\/+$/, "");
const supabaseKey = process.env.COPY_TO_SUPABASE_KEY?.trim();
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "photos";

for (const [name, value] of Object.entries({
  DATABASE_URL: databaseUrl,
  PRIVATE_OBJECT_DIR: privateDir,
  COPY_TO_SUPABASE_URL: supabaseUrl,
  COPY_TO_SUPABASE_KEY: supabaseKey,
})) {
  if (!value) throw new Error(`${name} is not set.`);
}

function replitLocation(relativePath) {
  const normalizedDir = privateDir.startsWith("/") ? privateDir : `/${privateDir}`;
  const [, bucketName, ...objectParts] = `${normalizedDir.replace(/\/+$/, "")}/${relativePath}`.split("/");
  return { bucketName, objectName: objectParts.join("/") };
}

async function replitDownload(relativePath) {
  const { bucketName, objectName } = replitLocation(relativePath);
  const signed = await fetch("http://127.0.0.1:1106/object-storage/signed-object-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "GET",
      expires_at: new Date(Date.now() + 300_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!signed.ok) throw new Error(`Replit signing failed (${signed.status}). Is this running inside Replit?`);
  const { signed_url: url } = await signed.json();
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Replit download failed (${response.status}).`);
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

const supabaseHeaders = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");

async function ensureBucket() {
  const existing = await fetch(`${supabaseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers: supabaseHeaders });
  if (existing.ok) return;
  const created = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...supabaseHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: false }),
  });
  if (!created.ok) throw new Error(`Could not create the Supabase bucket "${bucket}" (${created.status}): ${await created.text()}`);
}

async function supabaseUpload(relativePath, file) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(relativePath)}`, {
    method: "POST",
    headers: { ...supabaseHeaders, "Content-Type": file.contentType, "x-upsert": "true" },
    body: file.body,
  });
  if (!response.ok) throw new Error(`Supabase upload failed (${response.status}): ${await response.text()}`);
}

// Every column named like photo_path / photo_paths, text or text[].
async function photoPaths() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows: columns } = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name LIKE '%photo_path%'
    `);
    const paths = new Set();
    for (const { table_name, column_name, data_type } of columns) {
      const column = `"${column_name}"`;
      const values = data_type === "ARRAY" ? `unnest(${column})` : column;
      const { rows } = await client.query(`SELECT DISTINCT ${values} AS path FROM "${table_name}"`);
      for (const { path } of rows) if (typeof path === "string" && path.startsWith("/objects/")) paths.add(path);
      console.log(`${table_name}.${column_name}: ${rows.length} photo path(s)`);
    }
    return [...paths].sort();
  } finally {
    await client.end();
  }
}

const paths = await photoPaths();
console.log(`${paths.length} distinct photos to copy into Supabase bucket "${bucket}".`);
if (dryRun) process.exit(0);

await ensureBucket();

const missing = [];
const failed = [];
let copied = 0;
let next = 0;

async function worker() {
  while (next < paths.length) {
    const path = paths[next++];
    const relativePath = path.slice("/objects/".length);
    try {
      const file = await replitDownload(relativePath);
      if (!file) {
        missing.push(path);
        continue;
      }
      await supabaseUpload(relativePath, file);
      copied += 1;
      if (copied % 25 === 0) console.log(`Copied ${copied} of ${paths.length}…`);
    } catch (error) {
      failed.push({ path, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`Copied ${copied} of ${paths.length} photos.`);
if (missing.length > 0) console.log(`Not in Replit storage (skipped): ${missing.length}\n  ${missing.join("\n  ")}`);
if (failed.length > 0) {
  console.error(`Failed: ${failed.length}`);
  for (const { path, error } of failed) console.error(`  ${path}: ${error}`);
  console.error("Run the tool again to retry; photos already copied are simply overwritten.");
  process.exit(1);
}
