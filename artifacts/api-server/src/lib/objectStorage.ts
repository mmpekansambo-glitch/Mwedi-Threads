// Private photo storage on Replit object storage. Files are reached only
// through short-lived signed URLs, never directly.
export function storageLocation(relativePath: string) {
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

export async function signedObjectUrl(
  bucketName: string,
  objectName: string,
  method: "DELETE" | "GET" | "PUT",
): Promise<string> {
  const response = await fetch("http://127.0.0.1:1106/object-storage/signed-object-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + (method === "PUT" ? 900 : 300) * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Storage URL signing failed (${response.status}).`);
  const result = (await response.json()) as { signed_url?: string };
  if (!result.signed_url) throw new Error("Storage returned no signed URL.");
  return result.signed_url;
}

export async function deleteStoredObject(relativePath: string): Promise<void> {
  const { bucketName, objectName } = storageLocation(relativePath);
  const url = await signedObjectUrl(bucketName, objectName, "DELETE");
  const response = await fetch(url, {
    method: "DELETE",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Storage object deletion failed (${response.status}).`);
}
