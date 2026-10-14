import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:22863",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/repl/tools/bin/chromium",
    },
  },
  webServer: {
    command: "pnpm exec vite --config vite.e2e.config.ts --host 127.0.0.1",
    url: "http://127.0.0.1:22863",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
