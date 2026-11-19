import app from "./app";
import { logger } from "./lib/logger";
import { checkDatabaseSchema } from "./lib/schemaCheck";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void checkDatabaseSchema();
});

// Supabase's free plan pauses a database after a week without activity, which
// could happen in a quiet week with only a few makers. A tiny query twice a
// day keeps it awake.
const KEEP_AWAKE_MS = 12 * 60 * 60 * 1000;
setInterval(() => {
  pool.query("select 1").catch((err: unknown) => logger.warn({ err }, "Keep-awake database query failed"));
}, KEEP_AWAKE_MS).unref();

