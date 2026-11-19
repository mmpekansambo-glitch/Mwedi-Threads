// Plain-JavaScript copy of src/connection.ts for the scripts in this folder,
// which run with node directly. Keep the two in step.
export function isSupabaseUrl(url) {
  try {
    return /(^|\.)supabase\.(co|com)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function clientConfig(url) {
  if (!isSupabaseUrl(url)) return { connectionString: url };
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return { connectionString: parsed.toString(), ssl: { rejectUnauthorized: false } };
}
