import { defineConfig } from "drizzle-kit";
import path from "path";
import { isSupabaseUrl } from "./src/connection";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

function credentials(url: string) {
  if (!isSupabaseUrl(url)) return { url };
  // Supabase needs an encrypted connection; see src/connection.ts.
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
  };
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: credentials(process.env.DATABASE_URL),
});
