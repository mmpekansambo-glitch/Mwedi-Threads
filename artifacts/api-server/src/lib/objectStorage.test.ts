import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];

function respond(url: string, method: string) {
  if (url.endsWith("/storage/v1/bucket/photos")) return new Response("{}", { status: 400 });
  if (url.endsWith("/storage/v1/bucket")) return new Response("{}", { status: 200 });
  const path = url.replace("https://proj.supabase.co/storage/v1", "");
  if (path.startsWith("/object/upload/sign/")) return Response.json({ url: `${path}?token=up` });
  if (path.startsWith("/object/sign/")) return Response.json({ signedURL: `${path}?token=get` });
  if (method === "DELETE") return new Response(null, { status: 404 });
  return new Response(null, { status: 500 });
}

beforeEach(() => {
  calls.length = 0;
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "https://proj.supabase.co/");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, headers: init.headers as Record<string, string>, body: init.body as string | undefined });
    return respond(url, method);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("photo storage on Supabase", () => {
  it("keeps the relative path as the object name in the photos bucket", async () => {
    const { storageLocation } = await import("./objectStorage");
    expect(storageLocation("stash/user_1/abc")).toEqual({ bucketName: "photos", objectName: "stash/user_1/abc" });
  });

  it("creates the private bucket once, then signs uploads and downloads", async () => {
    const { signedObjectUrl } = await import("./objectStorage");
    const upload = await signedObjectUrl("photos", "stash/user 1/abc", "PUT");
    expect(upload).toBe("https://proj.supabase.co/storage/v1/object/upload/sign/photos/stash/user%201/abc?token=up");
    const download = await signedObjectUrl("photos", "stash/user 1/abc", "GET");
    expect(download).toBe("https://proj.supabase.co/storage/v1/object/sign/photos/stash/user%201/abc?token=get");

    const bucketCreates = calls.filter((call) => call.url.endsWith("/storage/v1/bucket"));
    expect(bucketCreates).toHaveLength(1);
    expect(JSON.parse(bucketCreates[0]!.body!)).toEqual({ id: "photos", name: "photos", public: false });
    expect(calls.every((call) => call.headers.apikey === "sb_secret_test")).toBe(true);
    expect(JSON.parse(calls.at(-1)!.body!)).toEqual({ expiresIn: 300 });
  });

  it("treats an already-missing photo as deleted", async () => {
    const { deleteStoredObject } = await import("./objectStorage");
    await expect(deleteStoredObject("progress/p1/photo")).resolves.toBeUndefined();
    expect(calls.at(-1)).toMatchObject({ method: "DELETE", url: "https://proj.supabase.co/storage/v1/object/photos/progress/p1/photo" });
  });

  it("falls back to Replit storage when Supabase is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("PRIVATE_OBJECT_DIR", "/replit-bucket/.private");
    const { storageLocation } = await import("./objectStorage");
    expect(storageLocation("stash/u/1")).toEqual({ bucketName: "replit-bucket", objectName: ".private/stash/u/1" });
  });
});
