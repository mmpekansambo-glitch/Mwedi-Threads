// Private photo storage. Files are reached only through short-lived signed
// URLs, never directly.
//
// Two places can hold the photos:
// - Supabase Storage, when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
//   (the bucket is SUPABASE_STORAGE_BUCKET, "photos" unless set). The bucket
//   is created, private, the first time it is needed.
// - Replit object storage otherwise, through the Replit sidecar. This only
//   works inside Replit and goes away when the app leaves Replit.
//
// A photo is saved in the database as /objects/<relative path> either way, so
// the same rows work with both.

type Method = "DELETE" | "GET" | "PUT";

const GET_SECONDS = 300;
const PUT_SECONDS = 900;

type SupabaseStorage = { url: string; key: string; bucket: string };

export function supabaseStorage(env: NodeJS.ProcessEnv = process.env): SupabaseStorage | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key, bucket: env.SUPABASE_STORAGE_BUCKET?.trim() || "photos" };
}

export function storageLocation(relativePath: string) {
  const supabase = supabaseStorage();
  if (supabase) return { bucketName: supabase.bucket, objectName: relativePath };
  return replitStorageLocation(relativePath);
}

export function replitStorageLocation(relativePath: string) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured.");
  const normalizedDir = privateDir.startsWith("/") ? privateDir : `/${privateDir}`;
  const fullPath = `${normalizedDir.replace(/\/+$/, "")}/${relativePath}`;
  const [, bucketName, ...objectParts] = fullPath.split("/");
  if (!bucketName || objectParts.length === 0) {
    throw new Error("PRIVATE_OBJECT_DIR is invalid.");
  }
  return { bucketName, objectName: objectParts.join("/") };
}

export async function signedObjectUrl(bucketName: string, objectName: string, method: Method): Promise<string> {
  const supabase = supabaseStorage();
  if (supabase) return supabaseSignedUrl(supabase, bucketName, objectName, method);
  return replitSignedUrl(bucketName, objectName, method);
}

export async function deleteStoredObject(relativePath: string): Promise<void> {
  const { bucketName, objectName } = storageLocation(relativePath);
  const supabase = supabaseStorage();
  if (supabase) {
    const response = await supabaseFetch(supabase, `/object/${bucketName}/${encodePath(objectName)}`, { method: "DELETE" });
    // Already gone counts as deleted.
    if (!response.ok && response.status !== 404 && response.status !== 400) {
      throw new Error(`Storage object deletion failed (${response.status}).`);
    }
    return;
  }
  const url = await replitSignedUrl(bucketName, objectName, "DELETE");
  const response = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Storage object deletion failed (${response.status}).`);
}

// --- Replit -----------------------------------------------------------------

export async function replitSignedUrl(bucketName: string, objectName: string, method: Method): Promise<string> {
  const response = await fetch("http://127.0.0.1:1106/object-storage/signed-object-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + (method === "PUT" ? PUT_SECONDS : GET_SECONDS) * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Storage URL signing failed (${response.status}).`);
  const result = (await response.json()) as { signed_url?: string };
  if (!result.signed_url) throw new Error("Storage returned no signed URL.");
  return result.signed_url;
}

// --- Supabase ---------------------------------------------------------------

function encodePath(objectName: string) {
  return objectName.split("/").map(encodeURIComponent).join("/");
}

function supabaseFetch(storage: SupabaseStorage, path: string, init: RequestInit = {}) {
  return fetch(`${storage.url}/storage/v1${path}`, {
    ...init,
    headers: {
      apikey: storage.key,
      Authorization: `Bearer ${storage.key}`,
      ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
}

const readyBuckets = new Set<string>();

export async function ensureSupabaseBucket(storage: SupabaseStorage, bucketName: string): Promise<void> {
  if (readyBuckets.has(bucketName)) return;
  const existing = await supabaseFetch(storage, `/bucket/${encodeURIComponent(bucketName)}`);
  if (!existing.ok) {
    const created = await supabaseFetch(storage, "/bucket", {
      method: "POST",
      body: JSON.stringify({ id: bucketName, name: bucketName, public: false }),
    });
    // Another request may have created it in the meantime.
    if (!created.ok && created.status !== 409) {
      const again = await supabaseFetch(storage, `/bucket/${encodeURIComponent(bucketName)}`);
      if (!again.ok) throw new Error(`Could not create the photo bucket (${created.status}).`);
    }
  }
  readyBuckets.add(bucketName);
}

async function supabaseSignedUrl(storage: SupabaseStorage, bucketName: string, objectName: string, method: Method) {
  await ensureSupabaseBucket(storage, bucketName);
  const path = `${encodeURIComponent(bucketName)}/${encodePath(objectName)}`;
  if (method === "DELETE") throw new Error("Use deleteStoredObject to delete from Supabase Storage.");

  if (method === "PUT") {
    const response = await supabaseFetch(storage, `/object/upload/sign/${path}`, { method: "POST" });
    if (!response.ok) throw new Error(`Storage URL signing failed (${response.status}).`);
    const result = (await response.json()) as { url?: string };
    if (!result.url) throw new Error("Storage returned no signed URL.");
    return `${storage.url}/storage/v1${result.url}`;
  }

  const response = await supabaseFetch(storage, `/object/sign/${path}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: GET_SECONDS }),
  });
  if (!response.ok) throw new Error(`Storage URL signing failed (${response.status}).`);
  const result = (await response.json()) as { signedURL?: string };
  if (!result.signedURL) throw new Error("Storage returned no signed URL.");
  return `${storage.url}/storage/v1${result.signedURL}`;
}
