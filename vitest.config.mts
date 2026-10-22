import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Full paths are used because this folder's name contains a colon.
const root = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.join(root, "tests/setup.ts")],
  },
});
