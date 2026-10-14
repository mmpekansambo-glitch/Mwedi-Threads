import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const testRoot = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(testRoot, "../../artifacts/indigoloom-web");
const clerkMock = resolve(testRoot, "fixtures/clerkMock.tsx");

export default defineConfig({
  root: webRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@clerk\/react\/internal$/, replacement: clerkMock },
      { find: /^@clerk\/react$/, replacement: clerkMock },
      { find: "@", replacement: resolve(webRoot, "src") },
      { find: "@assets", replacement: resolve(testRoot, "../../attached_assets") },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 22863,
    strictPort: true,
    allowedHosts: true,
  },
});
