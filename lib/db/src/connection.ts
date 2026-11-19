import type { PoolConfig } from "pg";

// Supabase only accepts encrypted connections, and its certificate is signed
// by Supabase's own authority rather than one Node already trusts. So for a
// Supabase address the connection is encrypted without checking that
// authority. Any other address (Replit, a local test database) is used as is.
export function isSupabaseUrl(url: string): boolean {
  try {
    return /(^|\.)supabase\.(co|com)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function poolConfig(url: string): PoolConfig {
  if (!isSupabaseUrl(url)) return { connectionString: url };
  const parsed = new URL(url);
  // An sslmode in the address would override the ssl setting below.
  parsed.searchParams.delete("sslmode");
  return {
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: false },
    // The free plan allows a small number of connections in total.
    max: 5,
  };
}
