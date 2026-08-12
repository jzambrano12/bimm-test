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
    // Confined to this project's own src/. Vitest otherwise discovers test
    // files recursively from the root, which sweeps in the generated apps
    // committed beside the boilerplate (generated-app/, inspector-app/) and
    // runs them against this config — their "@" alias then points at the
    // boilerplate's src/ and every one of their test files fails to load.
    //
    // The mirror image of the setupFiles note below: that one is a nested
    // project seeing its parent, this one is the parent seeing its children.
    // scaffold copies this file into every generated app, where the same
    // pattern still matches that app's own src/__tests__.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Absolute, not "./src/test-setup.ts". A relative setup file is resolved
    // against Vitest's inferred root, which is not this directory when the
    // project is nested inside another npm package — the setup file then
    // resolves to the parent's src/ and every test file fails to load before a
    // single assertion runs. Anchoring to the config's own directory makes the
    // project runnable wherever it is placed.
    setupFiles: [resolve(__dirname, "src/test-setup.ts")],
  },
});
