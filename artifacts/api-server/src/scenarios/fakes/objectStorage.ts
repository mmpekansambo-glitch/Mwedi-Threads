// Stands in for lib/objectStorage in the scenario stories. Photos "upload" to
// storage.test, which the stories answer themselves; deleted files are noted.
export const deletedPhotos: string[] = [];

export function storageLocation(relativePath: string) {
  return { bucketName: "scenario-bucket", objectName: relativePath };
}

export async function signedObjectUrl(bucketName: string, objectName: string, method: "DELETE" | "GET" | "PUT"): Promise<string> {
  return `https://storage.test/${method.toLowerCase()}/${bucketName}/${objectName}`;
}

export async function deleteStoredObject(relativePath: string): Promise<void> {
  deletedPhotos.push(relativePath);
}
