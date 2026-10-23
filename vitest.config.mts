import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Full paths are used because this folder's name contains a colon.
const root = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  // The colon in this folder name trips Vite's file-access check, so tests could not load.
  server: { fs: { strict: false } },
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
