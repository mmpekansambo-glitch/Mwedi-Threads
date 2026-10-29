import { defineConfig } from "@playwright/test";

// The browser scenario stories click through the web app against the real
// API and a throwaway PostgreSQL database (see "Scenario stories" in the
// README). They need PROJECTS_AUTH_TEST_DATABASE_URL.
if (!process.env.PROJECTS_AUTH_TEST_DATABASE_URL) {
  throw new Error("Set PROJECTS_AUTH_TEST_DATABASE_URL to a non-production PostgreSQL URL to run the scenario stories.");
}

export default defineConfig({
  testDir: "./scenarios",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:22863",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/repl/tools/bin/chromium",
    },
  },
  webServer: [
    {
      command: "pnpm exec vite --config vite.e2e.config.ts --host 127.0.0.1",
      url: "http://127.0.0.1:22863",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "node ../../artifacts/api-server/scenario-api.mjs",
      url: "http://127.0.0.1:22864/scenario/ready",
      reuseExistingServer: false,
      timeout: 90_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
      stdout: "pipe",
    },
  ],
});
