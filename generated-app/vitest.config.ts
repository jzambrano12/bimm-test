import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Absolute, not "./src/test-setup.ts". A relative setup file is resolved
    // against Vitest's inferred root, which is not this directory when the
    // project is nested inside another npm package — the setup file then
    // resolves to the parent's src/ and every test file fails to load before a
    // single assertion runs. Anchoring to the config's own directory makes the
    // project runnable wherever it is placed.
    setupFiles: [resolve(__dirname, "src/test-setup.ts")],
  },
});
