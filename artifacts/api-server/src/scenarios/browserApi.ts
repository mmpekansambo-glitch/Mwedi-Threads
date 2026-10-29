// The API the browser scenario stories click against: the real routes on a
// brand-new PostgreSQL database, with the stand-ins from fakes/ swapped in
// when scenario-api.mjs bundles this file. The browser story sends each
// maker's id in the x-test-user header.
import express from "express";
import { createScenarioDatabase } from "./scenarioDatabase";
import { printPhotos } from "./fakes/printPhoto";

const baseUrl = process.env.PROJECTS_AUTH_TEST_DATABASE_URL;
const dbPackage = process.env.SCENARIO_DB_PACKAGE;
const port = Number(process.env.SCENARIO_API_PORT ?? 22864);
if (!baseUrl || !dbPackage) throw new Error("Set PROJECTS_AUTH_TEST_DATABASE_URL to run the browser scenario stories.");

const database = await createScenarioDatabase(baseUrl, dbPackage);
process.env.DATABASE_URL = database.url;
const { default: routes } = await import("../routes/index");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).log = { debug: () => undefined, error: () => undefined, warn: () => undefined, info: () => undefined };
  next();
});
// A story says what the print photo check answers next.
app.put("/scenario/print-photos", (req, res) => {
  printPhotos.lookAlike = req.body.lookAlike ?? null;
  res.sendStatus(204);
});
app.get("/scenario/ready", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api", routes);

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Scenario API on http://127.0.0.1:${port}, database ${new URL(database.url).pathname.slice(1)}`);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  const { pool } = await import("@workspace/db");
  await pool.end().catch(() => undefined);
  await database.drop().catch((error: Error) => console.error("Could not drop the scenario database:", error.message));
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
