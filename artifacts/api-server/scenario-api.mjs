// Bundles src/scenarios/browserApi.ts with sign-in, photo storage and the
// print photo check (and the pretty logger) swapped for the stand-ins in src/scenarios/fakes, then
// runs it. Used by the browser scenario stories in packages/mwedi-tests.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const fakes = path.resolve(artifactDir, "src/scenarios/fakes");
const outfile = path.resolve(artifactDir, "dist/scenario/browserApi.mjs");

const swapForFakes = {
  name: "scenario-fakes",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@clerk\/express$/ }, () => ({ path: path.join(fakes, "clerk.ts") }));
    // Routes import "../lib/<name>" and lib files import "./<name>".
    pluginBuild.onResolve({ filter: /^\.{1,2}\/(?:lib\/)?(?:objectStorage|printPhoto|logger)$/ }, (args) => ({
      path: path.join(fakes, `${path.basename(args.path)}.ts`),
    }));
  },
};

await build({
  entryPoints: [path.resolve(artifactDir, "src/scenarios/browserApi.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile,
  logLevel: "warning",
  external: ["pg-native"],
  plugins: [swapForFakes],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
globalThis.require = __bannerCrReq(import.meta.url);`,
  },
});

process.env.SCENARIO_DB_PACKAGE ??= path.resolve(artifactDir, "../../lib/db");
await import(outfile);
